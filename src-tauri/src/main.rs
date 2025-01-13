// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let _guard = sentry::init(("https://941c7dc09f815c10e23b5da78c322226@o4507068185903104.ingest.de.sentry.io/4508636237332560", sentry::ClientOptions {
        release: sentry::release_name!(),
        ..Default::default()
      }));

    farm_station_25_lib::run()
}
