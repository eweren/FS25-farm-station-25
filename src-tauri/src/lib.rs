use std::process::Command;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use winapi::shared::minwindef::DWORD;

static mut PROCESS_EXITED: bool = false;
static mut PROCESS_RUNNING: bool = false;

#[tauri::command]
fn watch_farming_simulator_25(app: AppHandle, start: bool) {
    let app_handle = app.clone();
    std::thread::spawn(move || {
        check_process(start, &app_handle);

        loop {
            if (unsafe { PROCESS_EXITED } == true) {
                unsafe {
                    PROCESS_EXITED = false;
                }
                break;
            }
            check_process(false, &app_handle);
            std::thread::sleep(Duration::from_secs(1));
        }
    });
}

fn check_process(start_if_not_running: bool, app: &AppHandle) {
    let process_name = "FarmingSimulator2025Game.exe";
    let process_path = r"C:\Program Files (x86)\Farming Simulator 2025\FarmingSimulator2025.exe";

    if let Some(_process_id) = get_process_id(process_name) {
        unsafe {
            PROCESS_RUNNING = true;
        }
        app.emit("process-running", ()).unwrap();
        println!("Process {} is running", process_name);
    } else if start_if_not_running {
        Command::new(process_path)
            .spawn()
            .expect("Failed to start process");

        println!("Process {} started", process_name);
        app.emit("process-started", ()).unwrap();
    } else {
        if unsafe { PROCESS_RUNNING } == true {
            app.emit("process-exited", ()).unwrap();
            unsafe {
                PROCESS_EXITED = true;
            }
            println!("Process {} exited", process_name);
        }
        unsafe {
            PROCESS_RUNNING = false;
        }
        app.emit("process-not-running", ()).unwrap();
        println!("Process {} is not running", process_name);
    }
}

fn get_process_id(process_name: &str) -> Option<DWORD> {
    let output = Command::new("tasklist")
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
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![watch_farming_simulator_25])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
