// Única constante de URL do backend do app — nenhum serviço deve ter URL hardcoded.
const apiUrl = "http://localhost:4000";

export const environment = {
  apiUrl,
  wsUrl: apiUrl.replace(/^http/, "ws"),
};
