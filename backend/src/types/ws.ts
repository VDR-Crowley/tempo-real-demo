// Protocolo do WebSocket bidirecional: status do pedido + chat entre clientes.

import type { OrderStatusValue } from "./order.js";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isHelloMessage(value: unknown): value is HelloMessage {
  return (
    isRecord(value) &&
    value.type === "hello" &&
    (value.app === "angular" || value.app === "react") &&
    typeof value.nick === "string"
  );
}

export function isChatMessage(value: unknown): value is ChatMessage {
  return isRecord(value) && value.type === "chat" && typeof value.text === "string";
}

export function isTypingMessage(value: unknown): value is TypingMessage {
  return isRecord(value) && value.type === "typing";
}

export function isSubscribeMessage(value: unknown): value is SubscribeMessage {
  return isRecord(value) && value.type === "subscribe" && typeof value.orderId === "string";
}

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
