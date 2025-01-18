use regex::Regex;
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::error::Error;
use std::fs::{self, File};
use std::io::{BufReader, Read, Write};
use std::path::{Path, PathBuf};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};
use tauri_plugin_sentry::sentry;
use walkdir::WalkDir;
use xml2json_rs::JsonBuilder;
use zip::write::FileOptions;
use zip::{ZipArchive, ZipWriter};

use crate::config::Config;

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
        Ok(bool) => bool,
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
        // Write the default config to the file
        match serde_json::to_string_pretty(&config) {
            Ok(str) => str,
            Err(e) => {
                sentry::capture_message(
                    &format!("Error serializing config: {}", e.to_string()),
                    sentry::Level::Error,
                );
                log::error!("Error serializing config: {}", e);
                return config.into();
            }
        };
        return config.into();
    }

    let file_content = match fs::read_to_string(config_path) {
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
        Ok(bool) => bool,
        Err(e) => {
            sentry::capture_message(
                &format!("Error creating config path: {}", e.to_string()),
                sentry::Level::Error,
            );
            log::error!("Error creating config path: {}", e);
            return;
        }
    };

    match fs::write(config_path, config) {
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
                                && path.extension().and_then(|ext| ext.to_str()) == Some("zip")
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

// Creates a zip archive of all files within path.
pub fn create_zip_archive(
    path: PathBuf,
    output_path: PathBuf,
) -> Result<JsonValue, Box<dyn Error>> {
    log::info!("create_zip_archive {:?} {:?}", path, output_path);
    let file = std::fs::File::create(&output_path)?;
    let mut zip_writer = ZipWriter::new(file);

    let options = FileOptions::<()>::default()
        .compression_method(zip::CompressionMethod::Zstd)
        .unix_permissions(0o755);

    for entry in WalkDir::new(&path) {
        let entry = entry?;
        let entry_path = entry.path();
        if entry_path.is_file() {
            let relative_path = match entry_path.strip_prefix(&path) {
                Ok(path) => path,
                Err(e) => {
                    sentry::capture_message(
                        &format!("Error stripping prefix: {}", e.to_string()),
                        sentry::Level::Error,
                    );
                    log::error!("Error stripping prefix: {}", e);
                    continue;
                }
            };
            log::info!("entry {:?}", relative_path);
            match zip_writer.start_file(relative_path.to_str().unwrap(), options) {
                Ok(_) => (),
                Err(e) => {
                    sentry::capture_message(
                        &format!("Error starting file in zip: {}", e.to_string()),
                        sentry::Level::Error,
                    );
                    log::error!("Error starting file in zip: {}", e);
                    continue;
                }
            }
            match zip_writer.write_all(&std::fs::read(entry_path)?) {
                Ok(_) => (),
                Err(e) => {
                    sentry::capture_message(
                        &format!("Error writing file to zip: {}", e.to_string()),
                        sentry::Level::Error,
                    );
                    log::error!("Error writing file to zip: {}", e);
                    continue;
                }
            }
        }
    }

    zip_writer.finish()?;
    let pth_str = &output_path.clone().to_string_lossy().into_owned();
    log::info!("Created ZIP archive: {:?}", pth_str);
    Ok(JsonValue::String(pth_str.to_string()))
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

    let path = match app.path().resolve(dir, BaseDirectory::Document) {
        Ok(p) => p,
        Err(e) => {
            sentry::capture_message(
                &format!("Error resolving path: {}", e.to_string()),
                sentry::Level::Error,
            );

            log::error!("Error resolving path: {}", e);

            return JsonValue::Null;
        }
    };

    if !path.exists() {
        log::error!("Path does not exist: {:?}", path);
        return JsonValue::Null;
    }

    let mut savegame_folders = Vec::<String>::new();

    for entry in WalkDir::new(&path)
        .max_depth(1)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_dir())
    {
        let entry_path = entry.path();
        let re = Regex::new(r"savegame\d+").unwrap();
        if re.is_match(entry_path.file_name().unwrap().to_str().unwrap()) {
            savegame_folders.push(
                entry_path
                    .file_name()
                    .unwrap()
                    .to_str()
                    .unwrap()
                    .to_string(),
            );
        }
    }
    log::info!("get_folder_content {}", savegame_folders.len());

    savegame_folders.into()
}

// Reads the files at the specific path and creates a zip from it with filename.
#[tauri::command]
pub async fn read_files_as_zip(app: AppHandle, path: String, filename: String) -> JsonValue {
    log::info!("read_files_as_zip {:?} {:?}", path, filename);
    let doc_path = match app
        .path()
        .resolve(path.to_string(), BaseDirectory::Document)
    {
        Ok(p) => p,
        Err(e) => {
            sentry::capture_message(
                &format!(
                    "Error reading the files at the specified path: {}",
                    e.to_string()
                ),
                sentry::Level::Error,
            );
            log::error!(
                "Error reading the files at the specified path {}: {}",
                path,
                e
            );
            return JsonValue::Null;
        }
    }
    .join(filename.to_string());

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

    if !file_path.exists() {
        log::info!("File to be read as zip does not exist: {:?}", file_path);
        return JsonValue::Null;
    }

    match create_zip_archive(doc_path, file_path) {
        Ok(json_str) => json_str.into(),
        Err(e) => {
            sentry::capture_message(
                &format!("Error creating zip archive: {}", e.to_string()),
                sentry::Level::Error,
            );
            log::error!("Error creating zip archive: {}", e);
            return JsonValue::Null;
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
                &format!("Error opening zip file: {}", e.to_string()),
                sentry::Level::Error,
            );
            log::error!("Error opening zip file: {}", e);
            return None;
        }
    };

    let mut archive = match ZipArchive::new(BufReader::new(file)) {
        Ok(archive) => archive,
        Err(e) => {
            sentry::capture_message(
                &format!("Error reading zip archive: {}", e.to_string()),
                sentry::Level::Error,
            );
            log::error!("Error reading zip archive: {}", e);
            return None;
        }
    };

    for i in 0..archive.len() {
        let mut file = match archive.by_index(i) {
            Ok(file) => file,
            Err(e) => {
                sentry::capture_message(
                    &format!("Error accessing file in zip archive: {}", e.to_string()),
                    sentry::Level::Error,
                );
                log::error!("Error accessing file in zip archive: {}", e);
                continue;
            }
        };

        if let Some(name) = file.enclosed_name() {
            if name.to_str() == Some(filename) {
                let mut contents = String::new();
                if let Err(e) = file.read_to_string(&mut contents) {
                    sentry::capture_message(
                        &format!("Error reading file content: {}", e.to_string()),
                        sentry::Level::Error,
                    );
                    log::error!("Error reading file content: {}", e);
                    return None;
                }
                return Some(contents);
            }
        }
    }
    return Some("".to_string());
}
