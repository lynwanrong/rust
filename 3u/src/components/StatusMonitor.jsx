import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTauriEvent } from "../hooks/useTauriEvent";

const MAX_LOG = 200;

const DEFAULT_PRESETS = [
  "STATUS_REQ",
  "GET_TEMP",
  "GET_HUMIDITY",
  "GET_PRESSURE",
  "GET_ALL",
];

function alarmLabel(a) {
  const parts = [];
  if (a.temp_alarm) parts.push("T:ALM");
  else if (a.temp_warning) parts.push("T:WARN");
  if (a.tm_2_alarm) parts.push("M2:ALM");
  else if (a.tm_1_alarm) parts.push("M1:WARN");
  if (a.zc_2_alarm) parts.push("Z2:ALM");
  else if (a.zc_1_alarm) parts.push("Z1:WARN");
  if (a.zc_warning) parts.push("ZC:WARN");
  return parts.length ? parts.join(" ") : "OK";
}

function alarmClass(a) {
  if (a.temp_alarm || a.tm_2_alarm || a.zc_2_alarm) return "alarm-red";
  if (a.temp_warning || a.tm_1_alarm || a.zc_1_alarm || a.zc_warning) return "alarm-yellow";
  return "alarm-ok";
}

function clxAlarmLabel(a) {
  const parts = [];
  if (a.temp_alarm) parts.push("T:ALM");
  else if (a.temp_warning) parts.push("T:WARN");
  if (a.cl_1_alarm) parts.push("CL1:ALM");
  else if (a.cl_warning) parts.push("CL:WARN");
  if (a.zc_1_alarm) parts.push("ZC1:ALM");
  if (a.zc_2_alarm) parts.push("ZC2:ALM");
  return parts.length ? parts.join(" ") : "OK";
}

function clxAlarmClass(a) {
  if (a.temp_alarm || a.cl_1_alarm || a.zc_1_alarm || a.zc_2_alarm) return "alarm-red";
  if (a.temp_warning || a.cl_warning) return "alarm-yellow";
  return "alarm-ok";
}

function sensorLabel(s) {
  const faults = [];
  for (let i = 1; i <= 8; i++) {
    if (s[`sensor${i}`]) faults.push(i);
  }
  return faults.length ? faults.join(",") : "OK";
}

export default function StatusMonitor() {
  const [presets, setPresets] = useState(DEFAULT_PRESETS);
  const [selected, setSelected] = useState(DEFAULT_PRESETS[0]);
  const [customCmd, setCustomCmd] = useState("");
  const [dataLog, setDataLog] = useState([]);
  const [diagData, setDiagData] = useState(null);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({ totalBytes: 0, msgCount: 0, lastTime: null });
  const logEndRef = useRef(null);
  const customRef = useRef(null);

  useTauriEvent("status-data", (payload) => {
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

  useTauriEvent("diag-data", (payload) => {
    setDiagData(payload);
  });

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dataLog.length]);

  const handleSend = async (cmd) => {
    const command = cmd || selected;
    setError("");
    try {
      await invoke("send_command", { command, mode: "StatusMonitoring" });
    } catch (e) {
      setError(String(e));
    }
  };

  const handleClear = () => {
    setDataLog([]);
    setDiagData(null);
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

  const { trains, public: pubInfo } = diagData?.frame || {};

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
        {pubInfo && (
          <>
            <div className="stat-card">
              <div className="stat-label">线路号 / 列车号</div>
              <div className="stat-value-sm">
                {pubInfo.train_line} / {pubInfo.train_number}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">速度 km/h</div>
              <div className="stat-value-sm">{pubInfo.speed}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">当前站ID → 下一站ID</div>
              <div className="stat-value-sm">
                {pubInfo.curr_station_id} → {pubInfo.next_station_id}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Command Bar */}
      <div className="card command-card">
        <div className="card-header">
          <span className="card-title">命令下发</span>
          <span className="card-badge badge-blue">Monitor</span>
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
            ref={customRef}
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

      {/* Train Diagnostic Data */}
      {trains && trains.length > 0 && (
        <div className="card diag-card">
          <div className="card-header">
            <span className="card-title">列车诊断数据</span>
            <span className="card-badge badge-green">
              {pubInfo.year}/{String(pubInfo.mon).padStart(2, "0")}/{String(pubInfo.day).padStart(2, "0")}&nbsp;
              {String(pubInfo.hour).padStart(2, "0")}:{String(pubInfo.minute).padStart(2, "0")}:{String(pubInfo.sec).padStart(2, "0")}
            </span>
          </div>
          <div className="diag-table-wrapper">
            <table className="diag-table">
              <thead>
                <tr>
                  <th>车厢</th>
                  <th colSpan="8">轴箱温度 / 报警 (1~8位)</th>
                  <th colSpan="4">齿轮温度 (1~4)</th>
                  <th>传感器故障</th>
                  <th>前置器</th>
                  <th>主机</th>
                </tr>
              </thead>
              <tbody>
                {trains.map((t, i) => (
                  <tr key={i} className="diag-row">
                    <td className="diag-train-num">{i + 1}车</td>
                    {t.zx_temp.map((temp, j) => {
                      const alm = t.zx_alarm[j];
                      const cls = alarmClass(alm);
                      return (
                        <td key={j} className={`diag-cell ${cls}`}>
                          <div className="diag-temp">{temp}°C</div>
                          <div className="diag-status">{alarmLabel(alm)}</div>
                        </td>
                      );
                    })}
                    {t.clx_temp.map((temp, j) => {
                      const alm = t.clx_alarm[j];
                      const cls = clxAlarmClass(alm);
                      return (
                        <td key={j} className={`diag-cell ${cls}`}>
                          <div className="diag-temp">{temp}°C</div>
                          <div className="diag-status">{clxAlarmLabel(alm)}</div>
                        </td>
                      );
                    })}
                    <td className="diag-cell diag-sensor">
                      {sensorLabel(t.zx_sensor)}
                    </td>
                    <td className="diag-cell diag-sensor">
                      {[t.qzq_fault.qzq1, t.qzq_fault.qzq2, t.qzq_fault.qzq3, t.qzq_fault.qzq4].some(Boolean)
                        ? "故障" : "OK"}
                    </td>
                    <td className="diag-cell diag-sensor">
                      {t.host_info.train_host_fault || t.host_info.train_host_save_fault
                        ? "故障" : "OK"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Data Log */}
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
