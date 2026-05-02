use std::io::{self, Cursor};
use std::{error::Error, fs::File, path::Path};

use serde_json::Value as JsonValue;
use tauri::{path::BaseDirectory, AppHandle, Manager};
use tauri_plugin_sentry::sentry;
use zip::ZipArchive;

use crate::farms_structs::Farms;
use crate::savegame_structs::CareerSavegame;

/// Normalises a documents-relative path to forward slashes so the resolver and
/// the OS file APIs both accept it on every platform.
fn normalize_relative(input: &str) -> String {
    input.replace('\\', "/")
}

// Saves a savegame (in zip format from server) to the given directory.
#[tauri::command]
pub fn unwrap_and_save_savegame(app: AppHandle, data: Vec<u8>, dir: &str) -> JsonValue {
    log::info!("unwrap_and_save_savegame {:?}", dir);

    let normalized = normalize_relative(dir);
    let dir_path: std::path::PathBuf = match app.path().resolve(&normalized, BaseDirectory::Document) {
        Ok(p) => p,
        Err(e) => {
            sentry::capture_message(
                &format!("Error resolving savegame target dir '{}': {}", normalized, e),
                sentry::Level::Error,
            );
            log::error!("Error resolving savegame target dir '{}': {}", normalized, e);
            return JsonValue::Null;
        }
    };

    if let Some(parent) = dir_path.parent() {
        if !parent.exists() {
            if let Err(e) = std::fs::create_dir_all(parent) {
                sentry::capture_message(
                    &format!("Error creating savegame parent dir {:?}: {}", parent, e),
                    sentry::Level::Error,
                );
                log::error!("Error creating savegame parent dir {:?}: {}", parent, e);
                return JsonValue::Null;
            }
        }
    }

    match unwrap_savegame(data, dir_path.as_path()) {
        Ok(value) => value,
        Err(e) => {
            sentry::capture_message(
                &format!("Error unwrapping savegame: {}", e),
                sentry::Level::Error,
            );
            log::error!("Error unwrapping savegame: {}", e);
            JsonValue::Null
        }
    }
}

#[tauri::command]
pub fn parse_local_savegame_data(app: AppHandle, savegame_path: &str) -> JsonValue {
    log::info!("parse_local_savegame_data {:?}", savegame_path);

    let normalized = normalize_relative(savegame_path);
    let savegame_path = match app.path().resolve(&normalized, BaseDirectory::Document) {
        Ok(p) => p,
        Err(e) => {
            sentry::capture_message(
                &format!("Error creating savegame path '{}': {}", normalized, e),
                sentry::Level::Error,
            );
            log::error!("Error creating savegame path '{}': {}", normalized, e);
            return JsonValue::Null;
        }
    };

    if !savegame_path.exists() {
        // Steam-side empty folders are common, so this isn't an error.
        log::info!("savegame_path does not exist: {:?}", savegame_path);
        return JsonValue::Null;
    }

    let career_path = savegame_path.join("careerSavegame.xml");

    if !career_path.exists() {
        log::info!("career_path does not exist: {:?}", career_path);
        return JsonValue::Null;
    }

    let career_file = match File::open(&career_path) {
        Ok(file) => file,
        Err(e) => {
            sentry::capture_message(
                &format!("Error opening career file {:?}: {}", career_path, e),
                sentry::Level::Error,
            );
            log::error!("Error opening career file {:?}: {}", career_path, e);
            return JsonValue::Null;
        }
    };
    log::info!("career_file");
    let mut career_data: CareerSavegame = match serde_xml_rs::from_reader(career_file) {
        Ok(data) => data,
        Err(e) => {
            sentry::capture_message(
                &format!("Error parsing career file {:?}: {}", career_path, e),
                sentry::Level::Error,
            );
            log::error!("Error parsing career file {:?}: {}", career_path, e);
            return JsonValue::Null;
        }
    };

    // farms.xml is optional – missing it should not invalidate the whole
    // savegame entry, otherwise the user sees the savegame disappear from the
    // UI even though it loads fine in the game.
    let farms_path = savegame_path.join("farms.xml");
    if farms_path.exists() {
        match File::open(&farms_path) {
            Ok(farms_file) => match serde_xml_rs::from_reader::<_, Farms>(farms_file) {
                Ok(data) => career_data.farms = Some(data),
                Err(e) => {
                    sentry::capture_message(
                        &format!("Error parsing farms file {:?}: {}", farms_path, e),
                        sentry::Level::Warning,
                    );
                    log::warn!("Error parsing farms file {:?}: {}", farms_path, e);
                }
            },
            Err(e) => {
                sentry::capture_message(
                    &format!("Error opening farms file {:?}: {}", farms_path, e),
                    sentry::Level::Warning,
                );
                log::warn!("Error opening farms file {:?}: {}", farms_path, e);
            }
        }
    } else {
        log::info!("farms_path does not exist (optional): {:?}", farms_path);
    }

    log::info!("done_parsing_local_savegame_data");
    career_data.into()
}

// Unwraps a savegame to dest_path
pub fn unwrap_savegame(zip_bytes: Vec<u8>, dest_path: &Path) -> Result<JsonValue, Box<dyn Error>> {
    log::info!("unwrap_savegame {:?}", dest_path);

    let reader = Cursor::new(zip_bytes);
    let mut archive = ZipArchive::new(reader)?;

    if !dest_path.exists() {
        std::fs::create_dir_all(dest_path)?;
    }

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;

        // `enclosed_name()` rejects paths that try to escape the destination
        // directory (zip slip). Plus zips written on Windows often use
        // backslashes which `enclosed_name` already normalises – good.
        let outpath = match file.enclosed_name() {
            Some(path) => dest_path.join(path),
            None => {
                log::warn!(
                    "Skipping zip entry with unsafe or non-UTF8 path: {}",
                    file.name()
                );
                continue;
            }
        };
        if file.name().ends_with('/') || file.name().ends_with('\\') {
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
