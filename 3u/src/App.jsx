import { useState } from "react";
import ConnectionPanel from "./components/ConnectionPanel";
import StatusMonitor from "./components/StatusMonitor";
import DataSimulator from "./components/DataSimulator";
import "./App.css";

const menuItems = [
  { key: "status", label: "状态监控", icon: "📊" },
  { key: "simulation", label: "数据模拟", icon: "🔬" },
];

function App() {
  const [activeMenu, setActiveMenu] = useState("status");

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">PTU</div>
          <span className="logo-text">上位机系统</span>
        </div>
        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${activeMenu === item.key ? "nav-active" : ""}`}
              onClick={() => setActiveMenu(item.key)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="version">v0.1.0</span>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <h1 className="page-title">
            {activeMenu === "status" ? "状态监控" : "数据模拟"}
          </h1>
          <ConnectionPanel />
        </header>

        <main className="content">
          {activeMenu === "status" ? <StatusMonitor /> : <DataSimulator />}
        </main>
      </div>
    </div>
  );
}

export default App;
