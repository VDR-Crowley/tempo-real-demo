import type { ClientApp } from "../types/ws";

export interface ChatMessageView {
  id: string;
  app: ClientApp;
  nick: string;
  text: string;
  at: string;
}

interface ChatPanelProps {
  messages: ChatMessageView[];
  typingLabel: string | null;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
}

export default function ChatPanel({ messages, typingLabel, value, onChange, onSend }: ChatPanelProps) {
  return (
    <div className="chat-panel">
      <ul className="chat-panel__messages">
        {messages.map((message) => (
          <li key={message.id} className="chat-panel__message">
            <span className={`chat-panel__badge chat-panel__badge--${message.app}`}>{message.app}</span>
            <strong>{message.nick}</strong>
            <span className="chat-panel__time">{new Date(message.at).toLocaleTimeString()}</span>
            <p>{message.text}</p>
          </li>
        ))}
      </ul>
      <p className="chat-panel__typing">{typingLabel ?? " "}</p>
      <form
        className="chat-panel__form"
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Digite uma mensagem..." />
        <button type="submit">Enviar</button>
      </form>
    </div>
  );
}
