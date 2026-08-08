import axios from "axios";

let authExpiredHandler = null;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      authExpiredHandler?.();
    }
    return Promise.reject(error);
  }
);

export function setAuthExpiredHandler(handler) {
  authExpiredHandler = handler;
  return () => {
    if (authExpiredHandler === handler) authExpiredHandler = null;
  };
}

export function getErrorMessage(error, fallback) {
  const detail = error.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((item) => item.msg || String(item)).join(", ");
  }
  if (error.response?.status === 401) return "Sesión expirada. Vuelve a iniciar sesión.";
  if (!error.response) return "Sin conexión con el servidor.";
  return fallback;
}

export default api;
