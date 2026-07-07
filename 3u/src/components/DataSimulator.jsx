import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTauriEvent } from "../hooks/useTauriEvent";

const MAX_LOG = 200;

const DEFAULT_PRESETS = [
  "SIM_REQ",
  "SIM_WAVEFORM",
  "SIM_RANDOM",
  "SIM_PATTERN_A",
  "SIM_PATTERN_B",
];

export default function DataSimulator() {
  const [presets, setPresets] = useState(DEFAULT_PRESETS);
  const [selected, setSelected] = useState(DEFAULT_PRESETS[0]);
  const [customCmd, setCustomCmd] = useState("");
  const [dataLog, setDataLog] = useState([]);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({ totalBytes: 0, msgCount: 0, lastTime: null });
  const logEndRef = useRef(null);

  useTauriEvent("simulation-data", (payload) => {
    setDataLog((prev) => {
      const next = [...prev, payload];
      return next.length > MAX_LOG ? next.slice(-MAX_LOG) : next;
    });
    setStats((s) => ({
      totalBytes: s.totalBytes + payload.length,
      msgCount: s.msgCount + 1,
      lastTime: new Date(payload.timestamp).toLocaleTimeString(),
    }));
  });

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dataLog.length]);

  const handleSend = async (cmd) => {
    const command = cmd || selected;
    setError("");
    try {
      await invoke("send_command", { command, mode: "DataSimulation" });
    } catch (e) {
      setError(String(e));
    }
  };

  const handleClear = () => {
    setDataLog([]);
    setStats({ totalBytes: 0, msgCount: 0, lastTime: null });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && customCmd.trim()) {
      handleSend(customCmd.trim());
      setCustomCmd("");
    }
  };

  const addPreset = () => {
    const cmd = customCmd.trim();
    if (cmd && !presets.includes(cmd)) {
      setPresets([...presets, cmd]);
      setSelected(cmd);
      setCustomCmd("");
    }
  };

  return (
    <div className="monitor-layout">
      {/* Stats Cards */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">接收消息</div>
          <div className="stat-value">{stats.msgCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">总字节数</div>
          <div className="stat-value">{stats.totalBytes.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">最后接收</div>
          <div className="stat-value-sm">{stats.lastTime || "--:--:--"}</div>
        </div>
      </div>

      {/* Command Bar */}
      <div className="card command-card">
        <div className="card-header">
          <span className="card-title">命令下发</span>
          <span className="card-badge badge-green">Simulate</span>
        </div>
        <div className="command-row">
          <select
            className="cmd-select"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {presets.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button className="btn-primary" onClick={() => handleSend()}>
            发送
          </button>
          <div className="cmd-divider" />
          <input
            className="cmd-input"
            value={customCmd}
            onChange={(e) => setCustomCmd(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="自定义命令，回车发送"
          />
          <button
            className="btn-secondary"
            onClick={addPreset}
            disabled={!customCmd.trim()}
            title="添加到预设列表"
          >
            +预设
          </button>
          <button className="btn-secondary" onClick={handleClear}>
            清空
          </button>
        </div>
        {error && <div className="inline-error">{error}</div>}
      </div>

      {/* Data Log - fills remaining space */}
      <div className="card log-card">
        <div className="card-header">
          <span className="card-title">数据记录</span>
          <span className="card-count">{dataLog.length} 条</span>
        </div>
        <div className="log-table-wrapper">
          {dataLog.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📡</span>
              <span>等待数据... 请选择命令后点击发送</span>
            </div>
          ) : (
            <table className="log-table">
              <thead>
                <tr>
                  <th className="col-time">时间</th>
                  <th className="col-len">字节</th>
                  <th className="col-text">文本</th>
                  <th className="col-hex">HEX</th>
                </tr>
              </thead>
              <tbody>
                {dataLog.map((entry, i) => (
                  <tr key={i} className="log-row">
                    <td className="col-time">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="col-len">{entry.length}</td>
                    <td className="col-text">{entry.text}</td>
                    <td className="col-hex">{entry.hex}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}
