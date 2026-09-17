// Única constante de URL do backend do app — nenhum serviço deve ter URL hardcoded.
const apiUrlFromEnv = import.meta.env.VITE_API_URL;

export const API_URL =
  apiUrlFromEnv && apiUrlFromEnv.length > 0 ? apiUrlFromEnv : "http://localhost:4000";

export const WS_URL = API_URL.replace(/^http/, "ws");
