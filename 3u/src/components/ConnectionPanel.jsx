import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTauriEvent } from "../hooks/useTauriEvent";

export default function ConnectionPanel() {
  const [ip, setIp] = useState("127.0.0.1");
  const [port, setPort] = useState("8080");
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  useTauriEvent("connection-status", (payload) => {
    setConnected(payload.connected);
    setAddress(payload.address);
    setConnecting(false);
    if (!payload.connected) setError("");
  });

  const handleConnect = async () => {
    setError("");
    setConnecting(true);
    try {
      await invoke("connect", { ip, port: parseInt(port, 10) });
    } catch (e) {
      setConnecting(false);
      setError(String(e));
    }
  };

  const handleDisconnect = async () => {
    setError("");
    try {
      await invoke("disconnect");
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="connection-bar">
      <div className="conn-inputs">
        <input
          className="conn-ip"
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="IP"
          disabled={connected || connecting}
        />
        <span className="conn-sep">:</span>
        <input
          className="conn-port"
          value={port}
          onChange={(e) => setPort(e.target.value)}
          placeholder="Port"
          disabled={connected || connecting}
        />
      </div>

      {!connected ? (
        <button
          className="btn-connect"
          onClick={handleConnect}
          disabled={connecting}
        >
          {connecting ? "连接中..." : "连接"}
        </button>
      ) : (
        <button className="btn-disconnect" onClick={handleDisconnect}>
          断开
        </button>
      )}

      <div className={`conn-status ${connected ? "status-connected" : "status-disconnected"}`}>
        <span className="status-dot" />
        <span className="status-text">
          {connected ? address : "未连接"}
        </span>
      </div>

      {error && <span className="conn-error">{error}</span>}
    </div>
  );
}
