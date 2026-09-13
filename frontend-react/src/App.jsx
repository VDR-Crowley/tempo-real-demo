import { useState } from "react";
import PollingPanel from "./components/PollingPanel";
import SSEPanel from "./components/SSEPanel";
import SocketPanel from "./components/SocketPanel";

const TABS = [
  { id: "polling", label: "Polling", Panel: PollingPanel },
  { id: "sse", label: "SSE", Panel: SSEPanel },
  { id: "socket", label: "WebSocket", Panel: SocketPanel },
];

export default function App() {
  const [active, setActive] = useState("polling");
  const ActivePanel = TABS.find((tab) => tab.id === active).Panel;

  return (
    <div className="app">
      <h1>Tempo real — React</h1>
      <nav className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={tab.id === active ? "active" : ""}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <ActivePanel />
    </div>
  );
}
