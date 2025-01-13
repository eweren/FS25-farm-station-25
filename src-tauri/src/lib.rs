use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::error::Error;
use std::fs::{self, File};
use std::io::{self, prelude::*, BufReader, Cursor, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_sentry::{minidump, sentry};
use walkdir::WalkDir;
use winapi::shared::minwindef::DWORD;
use xml2json_rs::JsonBuilder;
use zip::write::FileOptions;
use zip::{ZipArchive, ZipWriter};

static mut PROCESS_EXITED: bool = false;
static mut PROCESS_RUNNING: bool = false;

static PROCESS_NAME: &str = "FarmingSimulator2025Game.exe";
// Asserts default windows installation path
static PROCESS_PATH: &str =
    r"C:\Program Files (x86)\Farming Simulator 2025\FarmingSimulator2025.exe";

#[derive(Serialize, Deserialize, Debug)]
struct ModDesc {
    filename: String,
    version: String,
    mod_name: String,
    titles: JsonValue,
}

impl Into<JsonValue> for ModDesc {
    fn into(self) -> JsonValue {
        serde_json::to_value(self).unwrap()
    }
}

// Returns the version number from the cargo.toml
#[tauri::command]
fn get_version_number(app: AppHandle) -> JsonValue {
    app.package_info().version.to_string().into()
}

// Starts polling the FS25 process
#[tauri::command(async)]
async fn watch_farming_simulator_25(app: AppHandle) {
    log::info!("watch_farming_simulator_25");
    let app_handle = app.clone();
    check_process(&app_handle);

    loop {
        if (unsafe { PROCESS_EXITED } == true) {
            unsafe {
                PROCESS_EXITED = false;
            }
            break;
        }
        check_process(&app_handle);
        std::thread::sleep(Duration::from_secs(3));
    }
}

// Starts FS25
#[tauri::command]
fn start_farming_simulator_25(app: AppHandle) {
    log::info!("start_farming_simulator_25");
    if let Some(_process_id) = get_process_id(PROCESS_NAME) {
        return;
    }
    Command::new(PROCESS_PATH)
        .spawn()
        .expect("Failed to start process");

    match app.emit("process-started", ()) {
        Ok(_) => {}
        Err(e) => {
            log::error!("Error emitting process-started event: {}", e);
        }
    };
}

// Reads the My Games/FarmingSimulator25 folder from the documents dir
#[tauri::command]
fn get_folder_content(app: AppHandle, dir: &str) -> JsonValue {
    log::info!("get_folder_content {}", dir);

    let path = match app.path().resolve(dir, BaseDirectory::Document) {
        Ok(p) => p,
        Err(e) => {
            log::error!("Error resolving path: {}", e);

            return JsonValue::Null;
        }
    };

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

// Takes an xml as string and converts it to json
#[tauri::command]
fn convert_xml_to_json(xml: &str) -> JsonValue {
    log::info!("convert_xml_to_json");
    let json_builder = JsonBuilder::default();
    match json_builder.build_from_xml(xml) {
        Ok(json_str) => json_str.into(),
        Err(e) => {
            log::error!("Error building JSON from XML: {}", e);
            return JsonValue::Null;
        }
    }
}

// Reads the files at the specific path and creates a zip from it with filename.
#[tauri::command]
fn read_files_as_zip(app: AppHandle, path: &str, filename: &str) -> JsonValue {
    log::info!("read_files_as_zip {:?} {:?}", path, filename);
    let doc_path = match app.path().resolve(path, BaseDirectory::Document) {
        Ok(p) => p,
        Err(e) => {
            log::error!(
                "Error reading the files at the specified path {}: {}",
                path,
                e
            );
            return JsonValue::Null;
        }
    }
    .join(filename);

    let file_path = match app
        .path()
        .resolve(format!("{}.zip", filename), BaseDirectory::AppLocalData)
    {
        Ok(p) => p,
        Err(e) => {
            log::error!("Error creating a zip path in AppLocalData: {}", e);
            return JsonValue::Null;
        }
    };

    match create_zip_archive(doc_path, file_path) {
        Ok(json_str) => json_str.into(),
        Err(e) => {
            log::error!("Error creating zip archive: {}", e);
            return JsonValue::Null;
        }
    }
}

// Saves a savegame (in zip format from server) to the given directory.
#[tauri::command]
fn unwrap_and_save_savegame(app: AppHandle, data: Vec<u8>, dir: &str) -> JsonValue {
    log::info!("unwrap_and_save_savegame {:?}", dir);

    let dir_path = match app.path().resolve(dir, BaseDirectory::Document) {
        Ok(p) => p,
        Err(e) => {
            log::error!("Error creating zip archive: {}", e);
            return JsonValue::Null;
        }
    };

    match unwrap_savegame(data, dir_path.as_path()) {
        Ok(bool) => bool.into(),
        Err(e) => {
            log::error!("Error creating zip archive: {}", e);
            return JsonValue::Null;
        }
    }
}

// Returns an array of metadata of all mods
#[tauri::command]
fn read_mod_desc_files(app_handle: tauri::AppHandle) -> JsonValue {
    log::info!("read_mod_desc_files");

    let binding = match app_handle.path().resolve(
        "My Games/FarmingSimulator2025/mods",
        BaseDirectory::Document,
    ) {
        Ok(bool) => bool,
        Err(e) => {
            log::error!("Error creating zip archive: {}", e);
            return JsonValue::Null;
        }
    };

    let doc_path = binding.as_path();
    match parse_mod_desc_files(doc_path) {
        Ok(mods) => mods.into(),
        Err(e) => {
            log::error!("Error building JSON from XML: {}", e);
            return JsonValue::Null;
        }
    }
}

// Parses all mod description files.
fn parse_mod_desc_files(folder: &Path) -> Result<JsonValue, JsonValue> {
    log::info!("parse_mod_desc_files {:?}", folder);

    let files = get_zip_file_paths(folder);

    let mut mods: Vec<JsonValue> = vec![];
    for entry in files {
        let file_content = match read_file_in_zip(entry.to_path_buf(), "modDesc.xml") {
            Some(content) => content,
            None => continue,
        };

        if file_content.len() == 0 {
            continue;
        }

        let json = &convert_xml_to_json(&file_content);

        let filename = match entry.file_name() {
            Some(name) => name.to_string_lossy().to_string(),
            None => continue,
        };

        let titles = match json.get("modDesc").and_then(|md| md.get("title")) {
            Some(title) => title.clone(),
            None => {
                log::error!("Error: title not found in modDesc");
                return Err(JsonValue::Null);
            }
        };

        let r#mod = ModDesc {
            mod_name: filename.replace(".zip", ""),
            filename,
            titles,
            version: match json.get("modDesc").and_then(|md| md.get("version")) {
                Some(version) => match version.as_array() {
                    Some(array) => array[0].to_string().replace('"', ""),
                    None => {
                        log::error!("Error: version is not an array");
                        return Err(JsonValue::Null);
                    }
                },
                None => {
                    log::error!("Error: version not found in modDesc");
                    return Err(JsonValue::Null);
                }
            },
        };
        match serde_json::to_value(r#mod) {
            Ok(mod_json) => mods.push(mod_json),
            Err(e) => {
                log::error!("Error serializing mod: {}", e);
                return Err(JsonValue::Null);
            }
        }
    }
    return Ok(JsonValue::Array(mods));
}

// Returns all files within a zip folder.
fn get_zip_file_paths(folder: &Path) -> Vec<PathBuf> {
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
                        Err(e) => log::error!("Error reading entry: {}", e),
                    }
                }
            }
            Err(e) => log::error!("Error reading directory: {}", e),
        }
    }
    zip_paths
}

// Creates a zip archive of all files within path.
fn create_zip_archive(path: PathBuf, output_path: PathBuf) -> Result<JsonValue, Box<dyn Error>> {
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
                    log::error!("Error stripping prefix: {}", e);
                    continue;
                }
            };
            log::info!("entry {:?}", relative_path);
            match zip_writer.start_file(relative_path.to_str().unwrap(), options) {
                Ok(_) => (),
                Err(e) => {
                    log::error!("Error starting file in zip: {}", e);
                    continue;
                }
            }
            match zip_writer.write_all(&std::fs::read(entry_path)?) {
                Ok(_) => (),
                Err(e) => {
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

// Unwraps a savegame to dest_path
fn unwrap_savegame(zip_bytes: Vec<u8>, dest_path: &Path) -> Result<JsonValue, Box<dyn Error>> {
    log::info!("unwrap_savegame {:?}", dest_path);

    let reader = Cursor::new(zip_bytes);
    let mut archive = ZipArchive::new(reader)?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        let outpath = match file.enclosed_name() {
            Some(path) => dest_path.join(path),
            None => continue,
        };
        if file.name().ends_with('/') {
            std::fs::create_dir_all(&outpath)?;
        } else {
            if let Some(parent) = outpath.parent() {
                if !parent.exists() {
                    std::fs::create_dir_all(parent)?;
                }
            }
            let mut outfile = File::create(&outpath)?;
            io::copy(&mut file, &mut outfile)?;
        }
    }

    Ok(JsonValue::Bool(true))
}

fn read_file_in_zip(path_to_zip: PathBuf, filename: &str) -> Option<String> {
    log::info!("read_file_in_zip {:?} {:?}", path_to_zip, filename);

    let file = match File::open(&path_to_zip) {
        Ok(file) => file,
        Err(e) => {
            log::error!("Error opening zip file: {}", e);
            return None;
        }
    };

    let mut archive = match ZipArchive::new(BufReader::new(file)) {
        Ok(archive) => archive,
        Err(e) => {
            log::error!("Error reading zip archive: {}", e);
            return None;
        }
    };

    for i in 0..archive.len() {
        let mut file = match archive.by_index(i) {
            Ok(file) => file,
            Err(e) => {
                log::error!("Error accessing file in zip archive: {}", e);
                continue;
            }
        };

        if let Some(name) = file.enclosed_name() {
            if name.to_str() == Some(filename) {
                let mut contents = String::new();
                if let Err(e) = file.read_to_string(&mut contents) {
                    log::error!("Error reading file content: {}", e);
                    return None;
                }
                return Some(contents);
            }
        }
    }
    return Some("".to_string());
}

fn check_process(app: &AppHandle) {
    if let Some(_process_id) = get_process_id(PROCESS_NAME) {
        unsafe {
            PROCESS_RUNNING = true;
        }
        match app.emit("process-running", ()) {
            Ok(_) => (),
            Err(e) => log::error!("Error emitting process-running event: {}", e),
        }
    } else {
        if unsafe { PROCESS_RUNNING } == true {
            match app.emit("process-exited", ()) {
                Ok(_) => (),
                Err(e) => log::error!("Error emitting process-exited event: {}", e),
            }
            unsafe {
                PROCESS_EXITED = true;
            }
        }
        unsafe {
            PROCESS_RUNNING = false;
        }
        match app.emit("process-not-running", ()) {
            Ok(_) => (),
            Err(e) => log::error!("Error emitting process-not-running event: {}", e),
        }
    }
}

fn get_process_id(process_name: &str) -> Option<DWORD> {
    let mut cmd = Command::new("tasklist");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW constant
    }

    let output = cmd
        .args(&["/FI", &format!("IMAGENAME eq {}", process_name)])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let lines: Vec<&str> = stdout.trim().split('\n').collect();

    if lines.len() < 3 {
        return None;
    }

    for line in lines.iter().skip(1) {
        let process_info: Vec<&str> = line.trim().split_whitespace().collect();
        if process_info.len() >= 2 {
            if let Ok(pid) = process_info[1].parse::<DWORD>() {
                return Some(pid);
            }
        }
    }

    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let client = sentry::init((
        "https://941c7dc09f815c10e23b5da78c322226@o4507068185903104.ingest.de.sentry.io/4508636237332560",
        sentry::ClientOptions {
            release: sentry::release_name!(),
            auto_session_tracking: true,
            ..Default::default()
        },
    ));

    // Caution! Everything before here runs in both app and crash reporter processes
    #[cfg(not(target_os = "ios"))]
    let _guard = minidump::init(&client);
    // Everything after here runs in only the app process

    tauri::Builder::default()
        .plugin(tauri_plugin_sentry::init_with_no_injection(&client))
        .plugin(
            tauri_plugin_log::Builder::new()
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
                .max_file_size(50_000 /* bytes */)
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::LogDir {
                        file_name: Some("logs".to_string()),
                    },
                ))
                .build(),
        )
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            watch_farming_simulator_25,
            get_folder_content,
            start_farming_simulator_25,
            convert_xml_to_json,
            read_files_as_zip,
            read_mod_desc_files,
            unwrap_and_save_savegame,
            get_version_number
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
