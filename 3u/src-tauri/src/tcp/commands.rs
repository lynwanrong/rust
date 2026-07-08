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
    format: Option<String>,
) -> Result<(), String> {
    let mut s = state.lock().await;
    s.current_mode = mode;

    let is_hex = format.as_deref() == Some("hex");

    match &mut s.writer {
        Some(writer) => {
            if is_hex {
                let hex = command.replace(char::is_whitespace, "");
                if hex.is_empty() {
                    return Err("HEX string is empty".to_string());
                }
                if hex.len() % 2 != 0 {
                    return Err("HEX string must have even length".to_string());
                }
                let bytes: Vec<u8> = (0..hex.len())
                    .step_by(2)
                    .map(|i| {
                        u8::from_str_radix(&hex[i..i + 2], 16)
                            .map_err(|e| format!("Invalid HEX at position {}: {}", i, e))
                    })
                    .collect::<Result<_, _>>()?;
                writer
                    .write_all(&bytes)
                    .await
                    .map_err(|e| format!("Send failed: {}", e))?;
            } else {
                writer
                    .write_all(command.as_bytes())
                    .await
                    .map_err(|e| format!("Send failed: {}", e))?;
                writer
                    .write_all(b"\n")
                    .await
                    .map_err(|e| format!("Send failed (newline): {}", e))?;
            }
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
