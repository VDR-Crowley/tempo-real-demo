import { useEffect, useState, type ComponentType } from "react";
import PollingPanel from "./patterns/polling/PollingPanel";
import LongPollingPanel from "./patterns/long-polling/LongPollingPanel";
import SSEPanel from "./patterns/sse/SSEPanel";
import SocketPanel from "./patterns/websocket/SocketPanel";
import { startNewOrder } from "./hooks/useCurrentOrder";

interface Tab {
  id: string;
  label: string;
  Panel: ComponentType;
}

const TABS: Tab[] = [
  { id: "polling", label: "Polling", Panel: PollingPanel },
  { id: "long-polling", label: "Long Polling", Panel: LongPollingPanel },
  { id: "sse", label: "SSE", Panel: SSEPanel },
  { id: "socket", label: "WebSocket", Panel: SocketPanel },
];

export default function App() {
  const [active, setActive] = useState<string>("polling");
  const activeTab = TABS.find((tab) => tab.id === active) ?? TABS[0];
  const ActivePanel = activeTab.Panel;

  useEffect(() => {
    startNewOrder();
  }, []);

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
