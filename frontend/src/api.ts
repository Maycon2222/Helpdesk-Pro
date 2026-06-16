import axios from "axios";

function resolveApiUrl() {
  const configured = import.meta.env.VITE_API_URL;
  const host = window.location.hostname;
  const accessedFromNetwork = host !== "localhost" && host !== "127.0.0.1";

  if (configured && !(accessedFromNetwork && configured.includes("localhost"))) {
    return configured;
  }

  if (accessedFromNetwork) {
    return `${window.location.protocol}//${host}:8000/api/v1`;
  }

  return configured || "http://localhost:8000/api/v1";
}

export const api = axios.create({
  baseURL: resolveApiUrl()
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("helpdesk_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function unwrap<T>(response: { data: { data: T } }): T {
  return response.data.data;
}
