use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncReadExt;
use tokio::net::tcp::{OwnedReadHalf, OwnedWriteHalf};
use tokio::sync::Mutex;

use super::protocol;
use super::types::{CommandMode, ConnectionStatusPayload, DiagDataPayload, TcpDataPayload};

pub struct AppState {
    pub writer: Option<OwnedWriteHalf>,
    pub current_mode: CommandMode,
    pub address: String,
}

pub type SharedState = Arc<Mutex<AppState>>;

impl AppState {
    pub fn new() -> Self {
        Self {
            writer: None,
            current_mode: CommandMode::Idle,
            address: String::new(),
        }
    }
}

pub async fn connect(
    app: AppHandle,
    state: &SharedState,
    ip: String,
    port: u16,
) -> Result<(), String> {
    let address = format!("{}:{}", ip, port);
    let stream = tokio::net::TcpStream::connect(&address)
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    let (reader, writer) = stream.into_split();

    {
        let mut s = state.lock().await;
        s.writer = Some(writer);
        s.current_mode = CommandMode::Idle;
        s.address = address.clone();
    }

    app.emit(
        "connection-status",
        ConnectionStatusPayload {
            connected: true,
            address: address.clone(),
        },
    )
    .map_err(|e| format!("Event emit failed: {}", e))?;

    let state_clone = Arc::clone(state);
    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        read_loop(app_clone, state_clone, reader).await;
    });

    Ok(())
}

async fn read_loop(app: AppHandle, state: SharedState, mut reader: OwnedReadHalf) {
    let mut buf = vec![0u8; 4096];

    loop {
        match reader.read(&mut buf).await {
            Ok(0) => break,
            Ok(n) => {
                let raw = &buf[..n];
                let hex = raw
                    .iter()
                    .map(|b| format!("{:02x}", b))
                    .collect::<Vec<_>>()
                    .join(" ");
                let text = String::from_utf8_lossy(raw).to_string();
                let timestamp = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64;

                let mode = {
                    let s = state.lock().await;
                    s.current_mode.clone()
                };

                let event_name = match mode {
                    CommandMode::StatusMonitoring => "status-data",
                    CommandMode::DataSimulation => "simulation-data",
                    CommandMode::Idle => "tcp-data",
                };

                let payload = TcpDataPayload {
                    hex,
                    text,
                    length: n,
                    timestamp,
                    mode,
                };

                let _ = app.emit(event_name, payload);

                // Try parse as protocol frame
                if let Some(frame) = protocol::parse_frame(raw) {
                    let _ = app.emit(
                        "diag-data",
                        DiagDataPayload { frame, timestamp },
                    );
                }
            }
            Err(e) => {
                eprintln!("[ptu] TCP read error: {}", e);
                let _ = app.emit(
                    "connection-status",
                    ConnectionStatusPayload {
                        connected: false,
                        address: String::new(),
                    },
                );
                break;
            }
        }
    }

    {
        let mut s = state.lock().await;
        s.writer = None;
        s.current_mode = CommandMode::Idle;
    }
    let _ = app.emit(
        "connection-status",
        ConnectionStatusPayload {
            connected: false,
            address: String::new(),
        },
    );
}

pub async fn disconnect(state: &SharedState) -> Result<(), String> {
    let mut s = state.lock().await;
    drop(s.writer.take());
    s.current_mode = CommandMode::Idle;
    Ok(())
}
