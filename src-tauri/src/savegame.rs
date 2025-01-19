use std::io::{self, Cursor};
use std::{error::Error, fs::File, path::Path};

use serde_json::Value as JsonValue;
use tauri::{path::BaseDirectory, AppHandle, Manager};
use tauri_plugin_sentry::sentry;
use zip::ZipArchive;

use crate::farms_structs::Farms;
use crate::savegame_structs::CareerSavegame;

// Saves a savegame (in zip format from server) to the given directory.
#[tauri::command]
pub fn unwrap_and_save_savegame(app: AppHandle, data: Vec<u8>, dir: &str) -> JsonValue {
    log::info!("unwrap_and_save_savegame {:?}", dir);

    let dir_path: std::path::PathBuf = match app.path().resolve(dir, BaseDirectory::Document) {
        Ok(p) => p,
        Err(e) => {
            sentry::capture_message(
                &format!("Error creating zip archive: {}", e.to_string()),
                sentry::Level::Error,
            );
            log::error!("Error creating zip archive: {}", e);
            return JsonValue::Null;
        }
    };

    match unwrap_savegame(data, dir_path.as_path()) {
        Ok(bool) => bool.into(),
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

#[tauri::command]
pub fn parse_local_savegame_data(app: AppHandle, savegame_path: &str) -> JsonValue {
    log::info!("parse_local_savegame_data {:?}", savegame_path);

    let savegame_path = match app.path().resolve(savegame_path, BaseDirectory::Document) {
        Ok(bool) => bool,
        Err(e) => {
            sentry::capture_message(
                &format!("Error creating savegame path: {}", e.to_string()),
                sentry::Level::Error,
            );
            log::error!("Error creating savegame path: {}", e);
            return JsonValue::Null;
        }
    };

    if !savegame_path.exists() {
        log::error!("savegame_path does not exist: {:?}", savegame_path);
        return JsonValue::Null;
    }

    let career_path = savegame_path.join("careerSavegame.xml");

    if !career_path.exists() {
        log::error!("career_path does not exist: {:?}", career_path);
        return JsonValue::Null;
    }

    let career_file = match File::open(&career_path) {
        Ok(file) => file,
        Err(e) => {
            sentry::capture_message(
                &format!("Error opening career file: {}", e.to_string()),
                sentry::Level::Error,
            );
            log::error!("Error opening career file: {}", e);
            return JsonValue::Null;
        }
    };
    log::info!("career_file");
    let career_data: CareerSavegame = match serde_xml_rs::from_reader(career_file) {
        Ok(data) => data,
        Err(e) => {
            sentry::capture_message(
                &format!("Error parsing career file: {}", e.to_string()),
                sentry::Level::Error,
            );
            log::error!("Error parsing career file: {}", e);
            return JsonValue::Null;
        }
    };

    let farms_path = savegame_path.join("farms.xml");

    if !farms_path.exists() {
        log::error!("farms_path does not exist: {:?}", farms_path);
        return JsonValue::Null;
    }

    let farms_file = match File::open(&farms_path) {
        Ok(file) => file,
        Err(e) => {
            sentry::capture_message(
                &format!("Error opening farms file: {}", e.to_string()),
                sentry::Level::Error,
            );
            log::error!("Error opening farms file: {}", e);
            return JsonValue::Null;
        }
    };

    log::info!("farms_file");
    let farms_data: Farms = match serde_xml_rs::from_reader(farms_file) {
        Ok(data) => data,
        Err(e) => {
            sentry::capture_message(
                &format!("Error parsing farms file: {}", e.to_string()),
                sentry::Level::Error,
            );
            log::error!("Error parsing farms file: {}", e);
            return JsonValue::Null;
        }
    };

    // Join career_data with farms_data by adding a farms field to career_data
    let mut career_data = career_data;
    career_data.farms = Some(farms_data);

    log::info!("done_parsing_local_savegame_data");
    return career_data.into();
}

// Unwraps a savegame to dest_path
pub fn unwrap_savegame(zip_bytes: Vec<u8>, dest_path: &Path) -> Result<JsonValue, Box<dyn Error>> {
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
