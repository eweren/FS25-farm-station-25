use crate::{
    file_utils::{convert_xml_to_json, get_zip_file_paths, read_file_in_zip},
    mod_structs::{CachedModDesc, CachedModDescriptions, SimplifiedModDesc},
};

use filetime::FileTime;
use serde_json::Value as JsonValue;
use std::{fs, path::Path, path::PathBuf};
use tauri::{path::BaseDirectory, Manager};
use tauri_plugin_sentry::sentry;

/// Returns the mods directory for FS25.
///
/// If the frontend supplies a `documents_relative_dir` (the user-configured FS25
/// game-data directory, relative to the platform's Documents folder), we resolve
/// against that. Otherwise we fall back to the Windows-default location. On
/// macOS / Linux the Documents-based default rarely exists, but the resolution
/// itself is platform-agnostic so we still return a valid path that the caller
/// can existence-check.
fn resolve_mods_dir(
    app_handle: &tauri::AppHandle,
    documents_relative_dir: Option<&str>,
) -> Option<PathBuf> {
    let relative = documents_relative_dir
        .filter(|s| !s.is_empty())
        .map(|s| {
            // Normalize backslashes to forward slashes so resolve() works on
            // platforms that don't treat `\` as a separator.
            let normalized = s.replace('\\', "/");
            if normalized.ends_with("/mods") {
                normalized
            } else {
                format!("{}/mods", normalized.trim_end_matches('/'))
            }
        })
        .unwrap_or_else(|| "My Games/FarmingSimulator2025/mods".to_string());

    match app_handle.path().resolve(&relative, BaseDirectory::Document) {
        Ok(path) => Some(path),
        Err(e) => {
            sentry::capture_message(
                &format!("Error resolving mods path '{}': {}", relative, e),
                sentry::Level::Error,
            );
            log::error!("Error resolving mods path '{}': {}", relative, e);
            None
        }
    }
}

// Returns an array of metadata of all mods.
//
// `documents_relative_dir` is optional and, when provided, points at the FS25
// game-data directory relative to Documents. The function always appends `/mods`.
#[tauri::command]
pub fn read_mod_desc_files(
    app_handle: tauri::AppHandle,
    documents_relative_dir: Option<String>,
) -> JsonValue {
    log::info!(
        "read_mod_desc_files (relative dir: {:?})",
        documents_relative_dir
    );

    let doc_path = match resolve_mods_dir(&app_handle, documents_relative_dir.as_deref()) {
        Some(path) => path,
        None => return JsonValue::Null,
    };

    if !doc_path.exists() {
        log::error!("Mods path does not exist: {:?}", doc_path);
        return JsonValue::Null;
    }

    match parse_mod_desc_files(doc_path.as_path()) {
        Ok(mods) => mods,
        Err(e) => {
            sentry::capture_message(
                &format!("Error parsing mod descriptions: {}", e),
                sentry::Level::Error,
            );
            log::error!("Error parsing mod descriptions: {}", e);
            JsonValue::Null
        }
    }
}

// Parses all mod description files. Errors on individual mods are logged and
// the mod is skipped, instead of aborting the whole scan.
pub fn parse_mod_desc_files(folder: &Path) -> Result<JsonValue, String> {
    log::info!("parse_mod_desc_files {:?}", folder);

    let cached_response_file = folder.join("mods.json");

    let mut cached_mod_desc: CachedModDescriptions = CachedModDescriptions { mods: vec![] };

    if cached_response_file.exists() {
        match std::fs::read_to_string(&cached_response_file) {
            Ok(content) => match serde_json::from_str::<CachedModDescriptions>(&content) {
                Ok(json) => cached_mod_desc = json,
                Err(e) => {
                    // Don't fail the whole scan – just discard the cache.
                    sentry::capture_message(
                        &format!("Error parsing cached mod descriptions, ignoring cache: {}", e),
                        sentry::Level::Warning,
                    );
                    log::warn!("Error parsing cached mod descriptions, ignoring cache: {}", e);
                }
            },
            Err(e) => {
                sentry::capture_message(
                    &format!("Error reading cached mod descriptions, ignoring cache: {}", e),
                    sentry::Level::Warning,
                );
                log::warn!("Error reading cached mod descriptions, ignoring cache: {}", e);
            }
        }
    }

    let files = get_zip_file_paths(folder);

    log::info!("Found {} mod files, {} cached", files.len(), cached_mod_desc.mods.len());

    let mut mods: Vec<JsonValue> = vec![];
    let mut updated_cache: Vec<CachedModDesc> = vec![];

    for entry in files {
        let filename_os = match entry.file_name() {
            Some(name) => name,
            None => continue,
        };
        let filename = match filename_os.to_str() {
            Some(s) => s.to_string(),
            None => {
                log::warn!("Skipping mod with non-UTF8 filename: {:?}", entry);
                continue;
            }
        };

        if !filename.starts_with("FS25_") {
            continue;
        }

        // Find entry in cache where filename matches.
        let cached_mod = cached_mod_desc.mods.iter().find(|m| m.filename == filename);

        let metadata = match fs::metadata(&entry) {
            Ok(m) => m,
            Err(e) => {
                sentry::capture_message(
                    &format!("Error reading metadata for mod {}: {}", filename, e),
                    sentry::Level::Warning,
                );
                log::warn!("Error reading metadata for mod {}: {}", filename, e);
                continue;
            }
        };
        let mtime = FileTime::from_last_modification_time(&metadata);

        // If cached_mod is found and the modification time matches, reuse the cache.
        if let Some(cached_mod) = cached_mod {
            if cached_mod.modified_at == mtime.nanoseconds() {
                if let Ok(json) = serde_json::to_value(cached_mod.mods.clone()) {
                    mods.push(json);
                }
                updated_cache.push(CachedModDesc {
                    filename: cached_mod.filename.clone(),
                    modified_at: cached_mod.modified_at,
                    mods: cached_mod.mods.clone(),
                });
                log::info!("Using cached mod: {}", cached_mod.filename);
                continue;
            }
        }

        let file_content = match read_file_in_zip(entry.to_path_buf(), "modDesc.xml") {
            Some(content) => content,
            None => continue,
        };

        if file_content.is_empty() {
            continue;
        }

        // Escape stray ampersands without double-escaping already-encoded entities.
        let safe_xml = escape_unescaped_ampersands(&file_content);
        let json = convert_xml_to_json(&safe_xml);

        let titles = match json.get("modDesc").and_then(|md| md.get("title")) {
            Some(title) => title.clone(),
            None => {
                log::warn!("Skipping mod {}: title not found in modDesc", filename);
                continue;
            }
        };
        let description = match json.get("modDesc").and_then(|md| md.get("description")) {
            Some(description) => description.clone(),
            None => {
                log::warn!("Skipping mod {}: description not found in modDesc", filename);
                continue;
            }
        };

        let version = match json.get("modDesc").and_then(|md| md.get("version")) {
            Some(version) => match version.as_array().and_then(|arr| arr.get(0)) {
                Some(v) => v.to_string().replace('"', ""),
                None => {
                    log::warn!("Skipping mod {}: version is not a non-empty array", filename);
                    continue;
                }
            },
            None => {
                log::warn!("Skipping mod {}: version not found in modDesc", filename);
                continue;
            }
        };

        let simplified_mod = SimplifiedModDesc {
            mod_name: filename.trim_end_matches(".zip").to_string(),
            filename: filename.clone(),
            titles,
            description,
            version,
        };

        updated_cache.push(CachedModDesc {
            filename: filename.clone(),
            modified_at: mtime.nanoseconds(),
            mods: simplified_mod.clone(),
        });

        match serde_json::to_value(simplified_mod) {
            Ok(mod_json) => mods.push(mod_json),
            Err(e) => {
                sentry::capture_message(
                    &format!("Error serializing mod {}: {}", filename, e),
                    sentry::Level::Warning,
                );
                log::warn!("Error serializing mod {}: {}", filename, e);
            }
        }
    }

    // Write the updated mods cache. A failure here should not abort the result.
    match serde_json::to_string(&CachedModDescriptions {
        mods: updated_cache,
    }) {
        Ok(json) => {
            if let Err(e) = std::fs::write(&cached_response_file, json) {
                sentry::capture_message(
                    &format!("Error writing cached response file: {}", e),
                    sentry::Level::Warning,
                );
                log::warn!("Error writing cached response file: {}", e);
            }
        }
        Err(e) => {
            sentry::capture_message(
                &format!("Error serializing cached mods: {}", e),
                sentry::Level::Warning,
            );
            log::warn!("Error serializing cached mods: {}", e);
        }
    }

    Ok(JsonValue::Array(mods))
}

/// Escapes bare `&` characters without disturbing already-escaped entities like
/// `&amp;`, `&lt;`, `&#x20;`, etc. Many modDesc.xml files in the wild contain
/// raw `&` in titles or descriptions, which the XML parser would otherwise
/// reject; the previous naive `replace("&", "&amp;")` corrupted valid entities.
fn escape_unescaped_ampersands(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = String::with_capacity(input.len());
    let mut i = 0;
    while i < bytes.len() {
        let c = bytes[i] as char;
        if c == '&' {
            // Look ahead for a valid entity terminated by `;` within a small window.
            let mut j = i + 1;
            let max = (i + 12).min(bytes.len());
            let mut found_semi = false;
            while j < max {
                let b = bytes[j];
                if b == b';' {
                    found_semi = true;
                    break;
                }
                if !(b.is_ascii_alphanumeric() || b == b'#') {
                    break;
                }
                j += 1;
            }
            if found_semi {
                out.push('&');
            } else {
                out.push_str("&amp;");
            }
        } else {
            out.push(c);
        }
        i += 1;
    }
    out
}
