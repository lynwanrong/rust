use serde::{Deserialize, Serialize};

use super::protocol::ParsedFrame;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CommandMode {
    Idle,
    StatusMonitoring,
    DataSimulation,
}

#[derive(Debug, Clone, Serialize)]
pub struct TcpDataPayload {
    pub hex: String,
    pub text: String,
    pub length: usize,
    pub timestamp: u64,
    pub mode: CommandMode,
}

#[derive(Debug, Clone, Serialize)]
pub struct DiagDataPayload {
    pub frame: ParsedFrame,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ConnectionStatusPayload {
    pub connected: bool,
    pub address: String,
}
