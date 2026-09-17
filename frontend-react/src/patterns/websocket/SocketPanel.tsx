import { useCurrentOrderId } from "../../hooks/useCurrentOrder";
import { useSocket } from "./useSocket";
import StatusTimeline from "../../components/StatusTimeline";
import ConnectionBadge from "../../components/ConnectionBadge";
import ChatPanel from "../../components/ChatPanel";

const APP = "react" as const;

export default function SocketPanel() {
  const orderId = useCurrentOrderId();
  const {
    connectionState,
    running,
    toggle,
    nick,
    setNick,
    status,
    done,
    peers,
    messages,
    typingLabel,
    chatInput,
    setChatInput,
    sendChat,
    notifyTyping,
    frames,
  } = useSocket(orderId);

  return (
    <section>
      <div className="panel-controls">
        <button onClick={toggle} disabled={!orderId}>
          {running ? "Desconectar" : "Conectar"}
        </button>
        <input
          className="nick-input"
          value={nick}
          onChange={(event) => setNick(event.target.value)}
          disabled={running}
          aria-label="Apelido"
        />
      </div>

      <div className="socket-half">
        <h3>Servidor → cliente</h3>
        <ConnectionBadge state={connectionState} />
        <StatusTimeline currentStatus={status} done={done} />
      </div>

      <div className="socket-half">
        <h3>Cliente ↔ cliente</h3>
        <p className="presence">
          {peers.length} conectados —{" "}
          {peers.map((peer) => (peer.nick === nick && peer.app === APP ? "você (React)" : peer.nick)).join(" · ")}
        </p>
        <ChatPanel
          messages={messages}
          typingLabel={typingLabel}
          value={chatInput}
          onChange={(value) => {
            setChatInput(value);
            notifyTyping();
          }}
          onSend={sendChat}
        />
        <p className="frames">
          <span className="frames__sent">↑ enviados: {frames.sent}</span>
          <span className="frames__received">↓ recebidos: {frames.received}</span>
        </p>
      </div>
    </section>
  );
}
