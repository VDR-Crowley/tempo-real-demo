import { useEffect, useRef, useState } from "react";
import { connectSocket, type SocketConnection } from "./socketService";
import type { OrderStatusValue } from "../../types/order";
import type { ClientApp, PresencePeer, ServerMessage } from "../../types/ws";
import type { ChatMessageView } from "../../components/ChatPanel";
import type { ConnectionState } from "../../components/ConnectionBadge";

const APP: ClientApp = "react";
const MAX_MESSAGES = 20;
const TYPING_TIMEOUT_MS = 2000;

interface UseSocketResult {
  connectionState: ConnectionState;
  running: boolean;
  toggle: () => void;
  nick: string;
  setNick: (nick: string) => void;
  status: OrderStatusValue | null;
  done: boolean;
  peers: PresencePeer[];
  messages: ChatMessageView[];
  typingLabel: string | null;
  chatInput: string;
  setChatInput: (value: string) => void;
  sendChat: () => void;
  notifyTyping: () => void;
  frames: { sent: number; received: number };
}

export function useSocket(orderId: string | null): UseSocketResult {
  const [connectionState, setConnectionState] = useState<ConnectionState>("desconectado");
  const [running, setRunning] = useState(false);
  const [nick, setNick] = useState(`${APP}-1`);
  const [status, setStatus] = useState<OrderStatusValue | null>(null);
  const [done, setDone] = useState(false);
  const [peers, setPeers] = useState<PresencePeer[]>([]);
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [typingLabel, setTypingLabel] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [frames, setFrames] = useState({ sent: 0, received: 0 });

  const connectionRef = useRef<SocketConnection | null>(null);
  const nickRef = useRef(nick);
  nickRef.current = nick;
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const countSent = (): void => setFrames((prev) => ({ ...prev, sent: prev.sent + 1 }));
  const countReceived = (): void => setFrames((prev) => ({ ...prev, received: prev.received + 1 }));

  function handleMessage(message: ServerMessage): void {
    if (message.type === "presence") {
      setPeers(message.peers);
      return;
    }
    if (message.type === "chat") {
      setMessages((prev) =>
        [...prev, { id: message.id, app: message.app, nick: message.nick, text: message.text, at: message.at }].slice(
          -MAX_MESSAGES
        )
      );
      return;
    }
    if (message.type === "typing") {
      const label = `${message.nick} (${message.app === "react" ? "React" : "Angular"}) está digitando...`;
      setTypingLabel(label);
      if (typingTimeoutRef.current !== null) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => setTypingLabel(null), TYPING_TIMEOUT_MS);
      return;
    }
    setStatus(message.status);
    setDone(message.done);
  }

  useEffect(() => {
    if (!running) {
      setConnectionState("desconectado");
      return;
    }

    setConnectionState("conectando");

    const connection = connectSocket({
      onOpen: () => {
        setConnectionState("conectado");
        connection.sendHello(APP, nickRef.current);
        countSent();
        if (orderId) {
          connection.subscribe(orderId);
          countSent();
        }
      },
      onClose: () => {
        setConnectionState("desconectado");
        setRunning(false);
      },
      onError: () => {
        // sem fechamento forçado — o navegador cuida do ciclo de vida nativo do WebSocket
      },
      onMessage: (message) => {
        countReceived();
        handleMessage(message);
      },
    });

    connectionRef.current = connection;

    return () => {
      connection.close();
      connectionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  useEffect(() => {
    setStatus(null);
    setDone(false);
    if (orderId && connectionRef.current) {
      connectionRef.current.subscribe(orderId);
      countSent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const toggle = () => setRunning((r) => !r);

  const sendChat = (): void => {
    const text = chatInput.trim();
    if (!text || !connectionRef.current) {
      return;
    }
    connectionRef.current.sendChat(text);
    countSent();
    setChatInput("");
  };

  const notifyTyping = (): void => {
    connectionRef.current?.sendTyping();
    countSent();
  };

  return {
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
  };
}
