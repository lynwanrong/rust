import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTauriEvent } from "../hooks/useTauriEvent";

const MAX_LOG = 200;
const STORAGE_KEY = "data-simulator-presets";

let _idCounter = 0;
function uid() {
  return `_custom_${Date.now()}_${_idCounter++}`;
}

const DEFAULT_PRESETS = [
  { id: "_sim_req", name: "SIM_REQ (ASCII)", command: "SIM_REQ", format: "ascii" },
  { id: "_sim_waveform", name: "SIM_WAVEFORM (ASCII)", command: "SIM_WAVEFORM", format: "ascii" },
  { id: "_sim_random", name: "SIM_RANDOM (ASCII)", command: "SIM_RANDOM", format: "ascii" },
  { id: "_sim_pattern_a", name: "SIM_PATTERN_A (ASCII)", command: "SIM_PATTERN_A", format: "ascii" },
  { id: "_sim_pattern_b", name: "SIM_PATTERN_B (ASCII)", command: "SIM_PATTERN_B", format: "ascii" },
];

function isDefault(id) {
  return id.startsWith("_") && !id.startsWith("_custom_");
}

function loadPresets() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  return [...DEFAULT_PRESETS];
}

function savePresets(presets) {
  const custom = presets.filter((p) => !isDefault(p.id));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
}

export default function DataSimulator() {
  const [presets, setPresets] = useState(loadPresets);
  const [selectedId, setSelectedId] = useState(() => presets[0]?.id || "");
  const [sendFormat, setSendFormat] = useState(() => presets[0]?.format || "ascii");
  const [customName, setCustomName] = useState("");
  const [customCmd, setCustomCmd] = useState("");
  const [customFormat, setCustomFormat] = useState("ascii");
  const [dataLog, setDataLog] = useState([]);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({ totalBytes: 0, msgCount: 0, lastTime: null });
  const logEndRef = useRef(null);

  const selectedPreset = presets.find((p) => p.id === selectedId);

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

  const handlePresetSelect = (id) => {
    setSelectedId(id);
    const p = presets.find((p) => p.id === id);
    if (p) setSendFormat(p.format);
  };

  const toggleSendFormat = () => {
    setSendFormat((f) => (f === "ascii" ? "hex" : "ascii"));
  };

  const toggleCustomFormat = () => {
    setCustomFormat((f) => (f === "ascii" ? "hex" : "ascii"));
  };

  const handleSend = async () => {
    const p = selectedPreset;
    if (!p) return;
    setError("");
    try {
      await invoke("send_command", {
        command: p.command,
        mode: "DataSimulation",
        format: sendFormat,
      });
    } catch (e) {
      setError(String(e));
    }
  };

  const handleSendCustom = async (cmd) => {
    const command = cmd || customCmd.trim();
    if (!command) return;
    setError("");
    try {
      await invoke("send_command", {
        command,
        mode: "DataSimulation",
        format: customFormat,
      });
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
      handleSendCustom(customCmd.trim());
      setCustomCmd("");
    }
  };

  const addPreset = () => {
    const cmd = customCmd.trim();
    if (!cmd) return;
    const name = customName.trim() || cmd;
    const newPreset = { id: uid(), name, command: cmd, format: customFormat };
    const updated = [...presets, newPreset];
    setPresets(updated);
    savePresets(updated);
    setSelectedId(newPreset.id);
    setSendFormat(customFormat);
    setCustomCmd("");
    setCustomName("");
  };

  const deletePreset = () => {
    if (!selectedPreset || isDefault(selectedPreset.id)) return;
    const updated = presets.filter((p) => p.id !== selectedId);
    setPresets(updated);
    savePresets(updated);
    if (updated.length > 0) {
      setSelectedId(updated[0].id);
      setSendFormat(updated[0].format);
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
            value={selectedId}
            onChange={(e) => handlePresetSelect(e.target.value)}
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} [{p.format.toUpperCase()}]
              </option>
            ))}
          </select>
          <button
            className={`fmt-toggle ${sendFormat === "hex" ? "fmt-hex" : "fmt-ascii"}`}
            onClick={toggleSendFormat}
            title="切换 ASCII / HEX 发送格式"
          >
            {sendFormat.toUpperCase()}
          </button>
          <button className="btn-primary" onClick={handleSend}>
            发送
          </button>
          {selectedPreset && !isDefault(selectedPreset.id) && (
            <button className="btn-delete-preset" onClick={deletePreset} title="删除此预设">
              ×
            </button>
          )}
          <div className="cmd-divider" />
          <input
            className="cmd-input-name"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="预设名称"
          />
          <input
            className="cmd-input"
            value={customCmd}
            onChange={(e) => setCustomCmd(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="自定义命令，回车发送"
          />
          <button
            className={`fmt-toggle ${customFormat === "hex" ? "fmt-hex" : "fmt-ascii"}`}
            onClick={toggleCustomFormat}
            title="切换 ASCII / HEX 发送格式"
          >
            {customFormat.toUpperCase()}
          </button>
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
