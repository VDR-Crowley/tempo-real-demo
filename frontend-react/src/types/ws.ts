// Protocolo do WebSocket bidirecional (backend/src/types/ws.ts) — status do
// pedido + chat entre os clientes conectados.

import type { OrderStatusValue } from "./order";

export type ClientApp = "angular" | "react";

export interface HelloMessage {
  type: "hello";
  app: ClientApp;
  nick: string;
}

export interface ChatMessage {
  type: "chat";
  text: string;
}

export interface TypingMessage {
  type: "typing";
}

export interface SubscribeMessage {
  type: "subscribe";
  orderId: string;
}

export type ClientMessage = HelloMessage | ChatMessage | TypingMessage | SubscribeMessage;

export interface PresencePeer {
  id: string;
  app: ClientApp;
  nick: string;
}

export interface PresenceServerMessage {
  type: "presence";
  peers: PresencePeer[];
}

export interface ChatServerMessage {
  type: "chat";
  id: string;
  app: ClientApp;
  nick: string;
  text: string;
  at: string;
}

export interface TypingServerMessage {
  type: "typing";
  app: ClientApp;
  nick: string;
}

export interface StatusServerMessage {
  type: "status";
  orderId: string;
  status: OrderStatusValue;
  seq: number;
  updatedAt: string;
  done: boolean;
}

export type ServerMessage =
  | PresenceServerMessage
  | ChatServerMessage
  | TypingServerMessage
  | StatusServerMessage;
