use crate::{
    file_utils::{convert_xml_to_json, get_zip_file_paths, read_file_in_zip},
    mod_structs::{CachedModDesc, CachedModDescriptions, SimplifiedModDesc},
};

use filetime::FileTime;
use serde_json::Value as JsonValue;
use std::{fs, path::Path};
use tauri::{path::BaseDirectory, Manager};
use tauri_plugin_sentry::sentry;

// Returns an array of metadata of all mods
#[tauri::command]
pub fn read_mod_desc_files(app_handle: tauri::AppHandle) -> JsonValue {
    log::info!("read_mod_desc_files");

    let binding = match app_handle.path().resolve(
        "My Games/FarmingSimulator2025/mods",
        BaseDirectory::Document,
    ) {
        Ok(path) => path,
        Err(e) => {
            sentry::capture_message(
                &format!("Error creating zip archive: {}", e.to_string()),
                sentry::Level::Error,
            );
            log::error!("Error creating zip archive: {}", e);
            return JsonValue::Null;
        }
    };

    let doc_path = binding.as_path();

    if !doc_path.exists() {
        log::error!("DocPath to be read does not exist: {:?}", doc_path);
        return JsonValue::Null;
    }

    match parse_mod_desc_files(doc_path) {
        Ok(mods) => mods.into(),
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

// Parses all mod description files.
pub fn parse_mod_desc_files(folder: &Path) -> Result<JsonValue, JsonValue> {
    log::info!("parse_mod_desc_files {:?}", folder);

    let cached_response_file = folder.join("mods.json");

    let mut cached_mod_desc: CachedModDescriptions = CachedModDescriptions { mods: vec![] };

    if cached_response_file.exists() {
        let file_content = match std::fs::read_to_string(&cached_response_file) {
            Ok(content) => content,
            Err(e) => {
                sentry::capture_message(
                    &format!("Error reading cached response file: {}", e.to_string()),
                    sentry::Level::Error,
                );
                log::error!("Error reading cached response file: {}", e);
                return Err(JsonValue::Null);
            }
        };

        // Parse the file as Array of ModDesc structs
        let json: CachedModDescriptions = match serde_json::from_str(&file_content) {
            Ok(json) => json,
            Err(e) => {
                sentry::capture_message(
                    &format!("Error parsing cached response file: {}", e.to_string()),
                    sentry::Level::Error,
                );
                log::error!("Error parsing cached response file: {}", e);
                return Err(JsonValue::Null);
            }
        };

        cached_mod_desc = json;
    }

    let files = get_zip_file_paths(folder);

    let mut mods: Vec<JsonValue> = vec![];
    for entry in files {
        // Find entry of cached_mod_desc where filename matches entry
        let cached_mod = cached_mod_desc
            .mods
            .iter()
            .find(|m| m.filename == entry.file_name().unwrap().to_str().unwrap().to_string());

        let metadata = fs::metadata(&entry).unwrap();
        let mtime = FileTime::from_last_modification_time(&metadata);

        // if cached_mod is found and the modification time is the same, use the cached_mod
        if let Some(cached_mod) = cached_mod {
            if cached_mod.modified_at == mtime.nanoseconds() {
                mods.push(serde_json::to_value(cached_mod.mods.clone()).unwrap());
                println!("Using cached mod: {}", cached_mod.filename);
                continue;
            }
        }

        let file_content = match read_file_in_zip(entry.to_path_buf(), "modDesc.xml") {
            Some(content) => content,
            None => continue,
        };

        if file_content.len() == 0 {
            continue;
        }

        let file_content = file_content.replace("&", "&amp;");
        let json = &convert_xml_to_json(&file_content);

        let filename = match entry.file_name() {
            Some(name) => name.to_string_lossy().to_string(),
            None => continue,
        };

        if !filename.starts_with("FS25_") {
            continue;
        }

        let copied_filename = filename.clone();

        let titles = match json.get("modDesc").and_then(|md| md.get("title")) {
            Some(title) => title.clone(),
            None => {
                sentry::capture_message("Error: title not found in modDesc", sentry::Level::Error);
                log::error!("Error: title not found in modDesc");
                return Err(JsonValue::Null);
            }
        };
        let description = match json.get("modDesc").and_then(|md| md.get("description")) {
            Some(description) => description.clone(),
            None => {
                sentry::capture_message(
                    "Error: description not found in modDesc",
                    sentry::Level::Error,
                );
                log::error!("Error: description not found in modDesc");
                return Err(JsonValue::Null);
            }
        };

        let simplified_mod = SimplifiedModDesc {
            mod_name: filename.replace(".zip", ""),
            filename,
            titles,
            description,
            version: match json.get("modDesc").and_then(|md| md.get("version")) {
                Some(version) => match version.as_array() {
                    Some(array) => array[0].to_string().replace('"', ""),
                    None => {
                        sentry::capture_message(
                            "Error: version is not an array",
                            sentry::Level::Error,
                        );
                        log::error!("Error: version is not an array");
                        return Err(JsonValue::Null);
                    }
                },
                None => {
                    sentry::capture_message(
                        "Error: version not found in modDesc",
                        sentry::Level::Error,
                    );
                    log::error!("Error: version not found in modDesc");
                    return Err(JsonValue::Null);
                }
            },
        };

        // create a cachedModDesc from mod
        let cached_mod = CachedModDesc {
            filename: copied_filename,
            modified_at: mtime.nanoseconds(),
            mods: simplified_mod.clone(),
        };
        // add cached_mod to cached_mod_desc
        cached_mod_desc.mods.push(cached_mod);

        match serde_json::to_value(simplified_mod) {
            Ok(mod_json) => {
                mods.push(mod_json);
            }
            Err(e) => {
                sentry::capture_message(
                    &format!("Error serializing mod: {}", e.to_string()),
                    sentry::Level::Error,
                );
                sentry::capture_message(
                    &format!("Error serializing mod: {}", e.to_string()),
                    sentry::Level::Error,
                );
                log::error!("Error serializing mod: {}", e);
                return Err(JsonValue::Null);
            }
        }
    }

    // Write the mods to the cache file
    let json = serde_json::to_string(&CachedModDescriptions {
        mods: cached_mod_desc.mods,
    })
    .unwrap();
    match std::fs::write(cached_response_file, json) {
        Ok(_) => {}
        Err(e) => {
            sentry::capture_message(
                &format!("Error writing cached response file: {}", e.to_string()),
                sentry::Level::Error,
            );
            log::error!("Error writing cached response file: {}", e);
            return Err(JsonValue::Null);
        }
    }

    return Ok(JsonValue::Array(mods));
}
