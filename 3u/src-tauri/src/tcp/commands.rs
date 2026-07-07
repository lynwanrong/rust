use tauri::{AppHandle, Emitter, State};
use tokio::io::AsyncWriteExt;

use super::connection::{self, SharedState};
use super::types::{CommandMode, ConnectionStatusPayload};

#[tauri::command]
pub async fn connect(
    app: AppHandle,
    state: State<'_, SharedState>,
    ip: String,
    port: u16,
) -> Result<(), String> {
    let arc = (*state).clone();
    connection::connect(app, &arc, ip, port).await
}

#[tauri::command]
pub async fn disconnect(
    app: AppHandle,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    let arc = (*state).clone();
    connection::disconnect(&arc).await?;
    let _ = app.emit(
        "connection-status",
        ConnectionStatusPayload {
            connected: false,
            address: String::new(),
        },
    );
    Ok(())
}

#[tauri::command]
pub async fn send_command(
    state: State<'_, SharedState>,
    command: String,
    mode: CommandMode,
) -> Result<(), String> {
    let mut s = state.lock().await;
    s.current_mode = mode;

    match &mut s.writer {
        Some(writer) => {
            writer
                .write_all(command.as_bytes())
                .await
                .map_err(|e| format!("Send failed: {}", e))?;
            writer
                .write_all(b"\n")
                .await
                .map_err(|e| format!("Send failed (newline): {}", e))?;
            Ok(())
        }
        None => Err("Not connected".to_string()),
    }
}

#[tauri::command]
pub async fn get_connection_status(
    state: State<'_, SharedState>,
) -> Result<ConnectionStatusPayload, ()> {
    let s = state.lock().await;
    Ok(ConnectionStatusPayload {
        connected: s.writer.is_some(),
        address: s.address.clone(),
    })
}
