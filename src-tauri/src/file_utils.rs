use regex::Regex;
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::error::Error;
use std::fs::{self, File};
use std::io::{BufReader, Read};
use std::path::{Path, PathBuf};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};
use tauri_plugin_sentry::sentry;
use walkdir::WalkDir;
use xml2json_rs::JsonBuilder;
use zip::write::FileOptions;
use zip::{ZipArchive, ZipWriter};

use crate::config::Config;

/// Normalises any user-supplied "documents-relative" path so the Tauri path
/// resolver and the OS file APIs both accept it.
///
/// The frontend used to hard-code Windows-style backslashes ("My
/// Games\\FarmingSimulator2025"). On macOS / Linux the backslash is a regular
/// filename character, so the resolver would build a literal directory called
/// `My Games\FarmingSimulator2025` which obviously doesn't exist – producing
/// the "could not be parsed/found/read" Sentry events. Always normalise.
fn normalize_relative_path(input: &str) -> String {
    input.replace('\\', "/")
}

/// Loads the config and returns it as a Config struct.
#[tauri::command]
pub fn load_config(app_handle: tauri::AppHandle, game_data_directory: &str) -> JsonValue {
    log::info!("start_loading_config");
    let config = Config {
        savegame_mapping: HashMap::new(),
        game_data_directory: game_data_directory.to_string(),
        team_id: None,
        invite_code: None,
        name: None,
        lang: None,
    };

    let config_path = match app_handle
        .path()
        .resolve("config.json", BaseDirectory::Config)
    {
        Ok(p) => p,
        Err(e) => {
            sentry::capture_message(
                &format!("Error creating config path: {}", e.to_string()),
                sentry::Level::Error,
            );
            log::error!("Error creating config path: {}", e);
            return config.into();
        }
    };
    if !config_path.exists() {
        log::info!("config_path_does_not_exist {:?}", config_path);
        // Make sure the parent directory exists before any future write attempt.
        if let Some(parent) = config_path.parent() {
            if !parent.exists() {
                if let Err(e) = fs::create_dir_all(parent) {
                    log::warn!("Error creating config dir {:?}: {}", parent, e);
                }
            }
        }
        return config.into();
    }

    let file_content = match fs::read_to_string(&config_path) {
        Ok(content) => content,
        Err(e) => {
            sentry::capture_message(
                &format!("Error reading config file: {}", e.to_string()),
                sentry::Level::Error,
            );
            log::error!("Error reading config file: {}", e);
            return config.into();
        }
    };
    log::info!("config_file_read");

    let content: Config = match serde_json::from_str(&file_content) {
        Ok(content) => content,
        Err(e) => {
            sentry::capture_message(
                &format!("Error parsing config file: {}", e.to_string()),
                sentry::Level::Error,
            );
            log::error!("Error parsing config file: {}", e);
            return config.into();
        }
    };

    log::info!("config_file_parsed");
    return content.into();
}

/// Tauri function to save the config to the config.json file.
/// The config is passed as a JSON string.
#[tauri::command]
pub fn save_config(app_handle: tauri::AppHandle, config: &str) {
    log::info!("save_config");
    let config_path = match app_handle
        .path()
        .resolve("config.json", BaseDirectory::Config)
    {
        Ok(p) => p,
        Err(e) => {
            sentry::capture_message(
                &format!("Error creating config path: {}", e.to_string()),
                sentry::Level::Error,
            );
            log::error!("Error creating config path: {}", e);
            return;
        }
    };

    if let Some(parent) = config_path.parent() {
        if !parent.exists() {
            if let Err(e) = fs::create_dir_all(parent) {
                sentry::capture_message(
                    &format!("Error creating config dir {:?}: {}", parent, e),
                    sentry::Level::Error,
                );
                log::error!("Error creating config dir {:?}: {}", parent, e);
                return;
            }
        }
    }

    match fs::write(&config_path, config) {
        Ok(_) => (),
        Err(e) => {
            sentry::capture_message(
                &format!("Error writing config file: {}", e.to_string()),
                sentry::Level::Error,
            );
            log::error!("Error writing config file: {}", e);
        }
    }
}

// Returns all files within a zip folder.
pub fn get_zip_file_paths(folder: &Path) -> Vec<PathBuf> {
    log::info!("get_zip_file_paths {:?}", folder);
    let mut zip_paths = Vec::new();
    if folder.is_dir() {
        match fs::read_dir(folder) {
            Ok(entries) => {
                for entry in entries {
                    match entry {
                        Ok(entry) => {
                            let path = entry.path();
                            if path.is_file()
                                && path
                                    .extension()
                                    .and_then(|ext| ext.to_str())
                                    .map(|ext| ext.eq_ignore_ascii_case("zip"))
                                    .unwrap_or(false)
                            {
                                zip_paths.push(path);
                            }
                        }
                        Err(e) => {
                            sentry::capture_message(
                                &format!("Error reading entry: {}", e.to_string()),
                                sentry::Level::Error,
                            );
                            log::error!("Error reading entry: {}", e);
                        }
                    }
                }
            }
            Err(e) => {
                sentry::capture_message(
                    &format!("Error reading directory: {}", e.to_string()),
                    sentry::Level::Error,
                );
                log::error!("Error reading directory: {}", e);
            }
        }
    }
    zip_paths
}

/// Converts an OS-specific relative path into the forward-slash form mandated
/// by the ZIP spec (PKWARE APPNOTE 4.4.17.1). Without this, archives produced
/// on Windows would carry `\` separators which most other tooling – including
/// the same archive being read back on macOS / Linux – cannot resolve.
fn zip_path_string(path: &Path) -> Option<String> {
    let mut parts = Vec::new();
    for component in path.components() {
        match component {
            std::path::Component::Normal(part) => match part.to_str() {
                Some(s) => parts.push(s.to_string()),
                None => return None,
            },
            // Skip prefixes/roots/curdir/parentdir – we only want the relative pieces.
            _ => {}
        }
    }
    if parts.is_empty() {
        None
    } else {
        Some(parts.join("/"))
    }
}

// Creates a zip archive of all files within path.
pub fn create_zip_archive(
    path: PathBuf,
    output_path: PathBuf,
) -> Result<JsonValue, Box<dyn Error>> {
    log::info!("create_zip_archive {:?} {:?}", path, output_path);

    if let Some(parent) = output_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)?;
        }
    }

    let file = std::fs::File::create(&output_path)?;
    let mut zip_writer = ZipWriter::new(file);

    let options = FileOptions::<()>::default()
        .compression_method(zip::CompressionMethod::Zstd)
        .unix_permissions(0o755);

    for entry in WalkDir::new(&path) {
        let entry = match entry {
            Ok(e) => e,
            Err(e) => {
                sentry::capture_message(
                    &format!("Error walking directory: {}", e),
                    sentry::Level::Warning,
                );
                log::warn!("Error walking directory: {}", e);
                continue;
            }
        };
        let entry_path = entry.path();
        if !entry_path.is_file() {
            continue;
        }
        let relative_path = match entry_path.strip_prefix(&path) {
            Ok(path) => path,
            Err(e) => {
                sentry::capture_message(
                    &format!("Error stripping prefix: {}", e),
                    sentry::Level::Warning,
                );
                log::warn!("Error stripping prefix: {}", e);
                continue;
            }
        };
        let zip_name = match zip_path_string(relative_path) {
            Some(name) => name,
            None => {
                log::warn!(
                    "Skipping file with non-UTF8 path inside zip: {:?}",
                    relative_path
                );
                continue;
            }
        };
        log::info!("zip entry {}", zip_name);
        if let Err(e) = zip_writer.start_file(&zip_name, options) {
            sentry::capture_message(
                &format!("Error starting file in zip ({}): {}", zip_name, e),
                sentry::Level::Warning,
            );
            log::warn!("Error starting file in zip ({}): {}", zip_name, e);
            continue;
        }
        // Stream the file rather than reading it all into memory – savegames
        // can be hundreds of megabytes and `fs::read` would briefly double the
        // peak memory usage.
        match File::open(entry_path) {
            Ok(mut input) => {
                if let Err(e) = std::io::copy(&mut input, &mut zip_writer) {
                    sentry::capture_message(
                        &format!("Error writing file to zip ({}): {}", zip_name, e),
                        sentry::Level::Warning,
                    );
                    log::warn!("Error writing file to zip ({}): {}", zip_name, e);
                    continue;
                }
            }
            Err(e) => {
                sentry::capture_message(
                    &format!("Error opening source file for zip ({}): {}", zip_name, e),
                    sentry::Level::Warning,
                );
                log::warn!("Error opening source file for zip ({}): {}", zip_name, e);
                continue;
            }
        }
    }

    zip_writer.finish()?;
    let pth_str = output_path.to_string_lossy().into_owned();
    log::info!("Created ZIP archive: {:?}", pth_str);
    Ok(JsonValue::String(pth_str))
}

// Takes an xml as string and converts it to json
#[tauri::command]
pub fn convert_xml_to_json(xml: &str) -> JsonValue {
    log::info!("convert_xml_to_json");
    let json_builder = JsonBuilder::default();
    match json_builder.build_from_xml(xml) {
        Ok(json_str) => json_str.into(),
        Err(e) => {
            sentry::capture_message(
                &format!("Error building JSON from XML: {}", e.to_string()),
                sentry::Level::Error,
            );
            log::error!("Error building JSON from XML: {}", e);
            return JsonValue::Null;
        }
    }
}

// Reads the My Games/FarmingSimulator25 folder from the documents dir
#[tauri::command]
pub fn get_folder_content(app: AppHandle, dir: &str) -> JsonValue {
    log::info!("get_folder_content {}", dir);

    let normalized = normalize_relative_path(dir);
    let path = match app.path().resolve(&normalized, BaseDirectory::Document) {
        Ok(p) => p,
        Err(e) => {
            sentry::capture_message(
                &format!("Error resolving path '{}': {}", normalized, e),
                sentry::Level::Error,
            );

            log::error!("Error resolving path '{}': {}", normalized, e);

            return JsonValue::Null;
        }
    };

    if !path.exists() {
        log::error!("Path does not exist: {:?}", path);
        return JsonValue::Null;
    }

    let mut savegame_folders = Vec::<String>::new();
    let re = Regex::new(r"^savegame\d").unwrap();

    for entry in WalkDir::new(&path)
        .max_depth(1)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_dir())
    {
        let entry_path = entry.path();
        let name = match entry_path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n,
            None => continue,
        };
        if re.is_match(name) {
            savegame_folders.push(name.to_string());
        }
    }
    log::info!("get_folder_content {}", savegame_folders.len());

    savegame_folders.into()
}

// Reads the files at the specific path and creates a zip from it with filename.
#[tauri::command]
pub async fn read_files_as_zip(app: AppHandle, path: String, filename: String) -> JsonValue {
    log::info!("read_files_as_zip {:?} {:?}", path, filename);
    let normalized = normalize_relative_path(&path);
    let doc_path = match app.path().resolve(&normalized, BaseDirectory::Document) {
        Ok(p) => p,
        Err(e) => {
            sentry::capture_message(
                &format!(
                    "Error reading the files at the specified path '{}': {}",
                    normalized, e
                ),
                sentry::Level::Error,
            );
            log::error!(
                "Error reading the files at the specified path {}: {}",
                normalized,
                e
            );
            return JsonValue::Null;
        }
    }
    .join(&filename);

    if !doc_path.exists() {
        log::error!("DocPath to be read does not exist: {:?}", doc_path);
        return JsonValue::Null;
    }

    let file_path = match app
        .path()
        .resolve(format!("{}.zip", filename), BaseDirectory::AppLocalData)
    {
        Ok(p) => p,
        Err(e) => {
            sentry::capture_message(
                &format!(
                    "Error creating a zip path in AppLocalData: {}",
                    e.to_string()
                ),
                sentry::Level::Error,
            );
            log::error!("Error creating a zip path in AppLocalData: {}", e);
            return JsonValue::Null;
        }
    };

    match create_zip_archive(doc_path, file_path) {
        Ok(json_str) => json_str,
        Err(e) => {
            sentry::capture_message(
                &format!("Error creating zip archive: {}", e.to_string()),
                sentry::Level::Error,
            );
            log::error!("Error creating zip archive: {}", e);
            JsonValue::Null
        }
    }
}

pub fn read_file_in_zip(path_to_zip: PathBuf, filename: &str) -> Option<String> {
    log::info!("read_file_in_zip {:?} {:?}", path_to_zip, filename);

    if !path_to_zip.exists() {
        log::error!("File to be read in zip does not exist: {:?}", path_to_zip);
        return None;
    }

    let file = match File::open(&path_to_zip) {
        Ok(file) => file,
        Err(e) => {
            sentry::capture_message(
                &format!("Error opening zip file {:?}: {}", path_to_zip, e),
                sentry::Level::Error,
            );
            log::error!("Error opening zip file {:?}: {}", path_to_zip, e);
            return None;
        }
    };

    let mut archive = match ZipArchive::new(BufReader::new(file)) {
        Ok(archive) => archive,
        Err(e) => {
            let msg = e.to_string();
            // Common case: a non-mod zip that just isn't a valid archive.
            // Don't spam Sentry for that.
            if msg.contains("invalid Zip archive") || msg.contains("Could not find EOCD") {
                log::warn!("Skipping invalid zip {:?}: {}", path_to_zip, msg);
                return None;
            }
            sentry::capture_message(
                &format!("Error reading zip archive {:?}: {}", path_to_zip, e),
                sentry::Level::Error,
            );
            log::error!("Error reading zip archive {:?}: {}", path_to_zip, e);
            return None;
        }
    };

    // Compare without depending on a specific path separator. ZIP files are
    // supposed to use forward slashes per spec, but plenty of writers don't
    // honour that, especially the Windows-built ones.
    let target = filename.replace('\\', "/");

    for i in 0..archive.len() {
        let mut file = match archive.by_index(i) {
            Ok(file) => file,
            Err(e) => {
                sentry::capture_message(
                    &format!("Error accessing file in zip archive: {}", e),
                    sentry::Level::Warning,
                );
                log::warn!("Error accessing file in zip archive: {}", e);
                continue;
            }
        };

        let normalized_name = file.name().replace('\\', "/");
        if normalized_name == target {
            let mut contents = String::new();
            if let Err(e) = file.read_to_string(&mut contents) {
                sentry::capture_message(
                    &format!("Error reading file content from zip {:?}: {}", path_to_zip, e),
                    sentry::Level::Error,
                );
                log::error!("Error reading file content from zip {:?}: {}", path_to_zip, e);
                return None;
            }
            return Some(contents);
        }
    }
    Some(String::new())
}
