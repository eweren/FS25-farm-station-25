use crate::{
    file_utils::{convert_xml_to_json, get_zip_file_paths, read_file_in_zip},
    ModDesc,
};

use serde_json::Value as JsonValue;
use std::path::Path;
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

        let file_content = file_content.replace("&", "&amp;");
        let json = &convert_xml_to_json(&file_content);

        let filename = match entry.file_name() {
            Some(name) => name.to_string_lossy().to_string(),
            None => continue,
        };

        if !filename.starts_with("FS25_") {
            continue;
        }

        let titles = match json.get("modDesc").and_then(|md| md.get("title")) {
            Some(title) => title.clone(),
            None => {
                sentry::capture_message("Error: title not found in modDesc", sentry::Level::Error);
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
        match serde_json::to_value(r#mod) {
            Ok(mod_json) => mods.push(mod_json),
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
    return Ok(JsonValue::Array(mods));
}
