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
use walkdir::WalkDir;
use winapi::shared::minwindef::DWORD;
use xml2json_rs::JsonBuilder;
use zip::write::FileOptions;
use zip::{ZipArchive, ZipWriter};

static mut PROCESS_EXITED: bool = false;
static mut PROCESS_RUNNING: bool = false;
static PROCESS_NAME: &str = "FarmingSimulator2025Game.exe";
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

#[tauri::command(async)]
async fn watch_farming_simulator_25(app: AppHandle) {
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

#[tauri::command]
fn start_farming_simulator_25(app: AppHandle) {
    if let Some(_process_id) = get_process_id(PROCESS_NAME) {
        return;
    }
    Command::new(PROCESS_PATH)
        .spawn()
        .expect("Failed to start process");

    app.emit("process-started", ()).unwrap();
}

#[tauri::command]
fn convert_xml_to_json(xml: &str) -> JsonValue {
    let json_builder = JsonBuilder::default();
    match json_builder.build_from_xml(xml) {
        Ok(json_str) => json_str.into(),
        Err(e) => {
            eprintln!("Error building JSON from XML: {}", e);
            return JsonValue::Null;
        }
    }
}

#[tauri::command]
fn read_file(app: AppHandle, path: &str, filename: &str) -> JsonValue {
    let doc_path = app
        .path()
        .resolve(path, BaseDirectory::Document)
        .unwrap()
        .join(filename);
    let file_path = app
        .path()
        .resolve(format!("{}.zip", filename), BaseDirectory::AppLocalData)
        .unwrap();
    match create_zip_archive(doc_path, file_path) {
        Ok(json_str) => json_str.into(),
        Err(e) => {
            eprintln!("Error creating zip archive: {}", e);
            return JsonValue::Null;
        }
    }
}

// data from frontend is ArrayBuffer
#[tauri::command]
fn save_savegame(app: AppHandle, data: Vec<u8>, dir: &str) -> JsonValue {
    let dir_path = app.path().resolve(dir, BaseDirectory::Document).unwrap();

    match unwrap_savegame(data, dir_path.as_path()) {
        Ok(bool) => bool.into(),
        Err(e) => {
            eprintln!("Error creating zip archive: {}", e);
            return JsonValue::Null;
        }
    }
}

#[tauri::command]
fn read_mod_desc_files(app_handle: tauri::AppHandle) -> JsonValue {
    let binding = app_handle
        .path()
        .resolve(
            "My Games/FarmingSimulator2025/mods",
            BaseDirectory::Document,
        )
        .unwrap();
    let doc_path = binding.as_path();
    match parse_mod_desc_files(doc_path) {
        Ok(json_str) => json_str.into(),
        Err(e) => {
            eprintln!("Error building JSON from XML: {}", e);
            return JsonValue::Null;
        }
    }
}

fn parse_mod_desc_files(folder: &Path) -> Result<JsonValue, JsonValue> {
    let files = get_zip_file_paths(folder);

    let mut mods: Vec<JsonValue> = vec![];
    for entry in files {
        let file_content = read_file_in_zip(entry.to_path_buf(), "modDesc.xml");

        if file_content.clone().unwrap().as_mut_str().len() == 0 {
            continue;
        }

        let json = &convert_xml_to_json(file_content.clone().unwrap().as_mut_str());

        let filename = entry
            .to_str()
            .unwrap()
            .split("/")
            .last()
            .unwrap()
            .split("\\")
            .last()
            .unwrap()
            .to_string();

        let titles = json.get("modDesc").unwrap().get("title").unwrap().clone();

        let r#mod = ModDesc {
            mod_name: filename.replace(".zip", ""),
            filename,
            titles,
            version: json
                .get("modDesc")
                .unwrap()
                .get("version")
                .unwrap()
                .as_array()
                .unwrap()[0]
                .to_string()
                .replace('"', ""),
        };
        mods.push(serde_json::to_value(r#mod).unwrap());
    }
    return Ok(JsonValue::Array(mods));
}

fn get_zip_file_paths(folder: &Path) -> Vec<PathBuf> {
    let mut zip_paths = Vec::new();
    if folder.is_dir() {
        for entry in fs::read_dir(folder).unwrap() {
            let entry = entry.unwrap();
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|ext| ext.to_str()) == Some("zip") {
                zip_paths.push(path);
            }
        }
    }
    zip_paths
}

fn create_zip_archive(path: PathBuf, output_path: PathBuf) -> Result<JsonValue, Box<dyn Error>> {
    println!("output_path {:?}", output_path);
    println!("path {:?}", &path);
    let file = std::fs::File::create(&output_path)?;
    println!("file");
    let mut zip_writer = ZipWriter::new(file);
    println!("zip");

    let options = FileOptions::<()>::default()
        .compression_method(zip::CompressionMethod::Zstd)
        .unix_permissions(0o755);
    println!("options");

    for entry in WalkDir::new(&path) {
        let entry = entry?;
        let entry_path = entry.path();
        if entry_path.is_file() {
            let relative_path = entry_path.strip_prefix(&path).unwrap();
            println!("entry {:?}", relative_path);
            zip_writer.start_file(relative_path.to_str().unwrap(), options)?;
            zip_writer.write_all(&std::fs::read(entry_path)?)?;
        }
    }

    zip_writer.finish()?;
    let pth_str = &output_path.clone().to_string_lossy().into_owned();
    println!("Created ZIP archive: {:?}", pth_str);
    Ok(JsonValue::String(pth_str.to_string()))
}

fn unwrap_savegame(zip_bytes: Vec<u8>, dest_path: &Path) -> Result<JsonValue, Box<dyn Error>> {
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
    let file = File::open(path_to_zip).unwrap();
    let mut archive = ZipArchive::new(BufReader::new(file)).unwrap();

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).unwrap();
        if let Some(name) = file.enclosed_name() {
            if name.to_str() == Some(filename) {
                // Lese den Inhalt der Datei "modDesc.xml"
                let mut contents = String::new();
                file.read_to_string(&mut contents).unwrap();
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
        app.emit("process-running", ()).unwrap();
    } else {
        if unsafe { PROCESS_RUNNING } == true {
            app.emit("process-exited", ()).unwrap();
            unsafe {
                PROCESS_EXITED = true;
            }
        }
        unsafe {
            PROCESS_RUNNING = false;
        }
        app.emit("process-not-running", ()).unwrap();
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
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            watch_farming_simulator_25,
            start_farming_simulator_25,
            convert_xml_to_json,
            read_file,
            read_mod_desc_files,
            save_savegame
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
