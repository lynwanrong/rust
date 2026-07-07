mod tcp;

use std::sync::Arc;
use tokio::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Arc::new(Mutex::new(tcp::connection::AppState::new())))
        .invoke_handler(tauri::generate_handler![
            tcp::commands::connect,
            tcp::commands::disconnect,
            tcp::commands::send_command,
            tcp::commands::get_connection_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
