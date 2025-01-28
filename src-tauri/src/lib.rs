mod config;
mod farms_structs;
mod file_utils;
mod mod_structs;
mod mods;
mod savegame;
mod savegame_structs;

use file_utils::{
    convert_xml_to_json, get_folder_content, load_config, read_files_as_zip, save_config,
};
use mods::read_mod_desc_files;
use savegame::{parse_local_savegame_data, unwrap_and_save_savegame};
use serde_json::Value as JsonValue;
use std::process::Command;
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_sentry::{minidump, sentry};
use winapi::shared::minwindef::DWORD;

static mut PROCESS_EXITED: bool = false;
static mut PROCESS_RUNNING: bool = false;

static PROCESS_NAME: &str = "FarmingSimulator2025Game.exe";
// Asserts default windows installation path
static PROCESS_PATH: &str =
    r"C:\Program Files (x86)\Farming Simulator 2025\FarmingSimulator2025.exe";

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
async fn start_farming_simulator_25(app: AppHandle) {
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
            sentry::capture_message(
                &format!("Error emitting process-started event: {}", e.to_string()),
                sentry::Level::Error,
            );
            log::error!("Error emitting process-started event: {}", e);
        }
    };
}

fn check_process(app: &AppHandle) {
    if let Some(_process_id) = get_process_id(PROCESS_NAME) {
        unsafe {
            PROCESS_RUNNING = true;
        }
        match app.emit("process-running", ()) {
            Ok(_) => (),
            Err(e) => {
                sentry::capture_message(
                    &format!("Error emitting process-running event: {}", e.to_string()),
                    sentry::Level::Error,
                );
                log::error!("Error emitting process-running event: {}", e);
            }
        }
    } else {
        if unsafe { PROCESS_RUNNING } == true {
            match app.emit("process-exited", ()) {
                Ok(_) => (),
                Err(e) => {
                    sentry::capture_message(
                        &format!("Error emitting process-exited event: {}", e.to_string()),
                        sentry::Level::Error,
                    );
                    log::error!("Error emitting process-exited event: {}", e);
                }
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
            Err(e) => {
                sentry::capture_message(
                    &format!(
                        "Error emitting process-not-running event: {}",
                        e.to_string()
                    ),
                    sentry::Level::Error,
                );
                log::error!("Error emitting process-not-running event: {}", e);
            }
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
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        // minimize to tray icon (tauri 2.0)
        .on_window_event(|window, event| {
            println!("Event: {:?}", event);
            #[cfg(not(target_os = "linux"))]
            if let tauri::WindowEvent::Moved(position) = event {
                print!("position {:?}", position);
                if position.x < -1960 && position.y < -1080 && window.is_visible().unwrap() {
                    std::thread::sleep(Duration::from_millis(100));

                    window.hide().unwrap();
                }
            }
        })
        .setup(|app| {
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&quit_i])?;

            TrayIconBuilder::new()
                .menu(&menu)
                .icon(app.default_window_icon().unwrap().clone())
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(666);
                    }
                    _ => {}
                })
                .title("Farm Station 2025")
                .on_tray_icon_event(|tray, event| match event {
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } => {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            window.show().expect("failed to show window");
                            window.unminimize().expect("failed to unminimize window");
                            window.set_focus().expect("failed to focus window");
                        }
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = app
                .get_webview_window("main")
                .expect("no main window")
                .set_focus();
        }))
        .plugin(tauri_plugin_sentry::init_with_no_injection(&client))
        .plugin(
            tauri_plugin_log::Builder::new()
                .max_file_size(50_000)
                .level(log::LevelFilter::Info)
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
            parse_local_savegame_data,
            get_version_number,
            load_config,
            save_config
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|_app_handle, event| match event {
            tauri::RunEvent::ExitRequested { api, code, .. } if code.unwrap() == 666 => {
                api.prevent_exit();
            }
            _ => {}
        });
}
