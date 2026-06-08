import { useEffect, useState } from "react";
import api, { getErrorMessage } from "../api.js";
import { formatTime } from "../utils/format.js";

export default function NotificationPanel({ open, onClose, onOpenChannel }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadNotifications = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/api/notifications");
      setNotifications(response.data);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudieron cargar las notificaciones."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadNotifications();
  }, [open]);

  const handleOpen = async (notification) => {
    try {
      await api.post(`/api/notifications/${notification.id}/read`);
      onOpenChannel(notification.channel_id);
      onClose();
    } catch {
      onOpenChannel(notification.channel_id);
      onClose();
    }
  };

  const handleReadAll = async () => {
    try {
      await api.post("/api/notifications/read-all");
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
    } catch (err) {
      setError(getErrorMessage(err, "No se pudieron marcar como leídas."));
    }
  };

  if (!open) return null;

  return (
    <div className="absolute right-0 top-12 z-40 w-96 overflow-hidden rounded-xl border border-white/10 bg-sidebar shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-100">Notificaciones</h3>
        <button
          type="button"
          onClick={handleReadAll}
          className="text-xs text-accent hover:underline"
        >
          Marcar todas
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {loading && <p className="px-4 py-6 text-sm text-slate-400">Cargando...</p>}
        {error && <p className="px-4 py-6 text-sm text-red-400">{error}</p>}
        {!loading && notifications.length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-400">No tienes notificaciones.</p>
        )}

        {notifications.map((notification) => (
          <button
            key={notification.id}
            type="button"
            onClick={() => handleOpen(notification)}
            className={`flex w-full flex-col gap-1 border-b border-white/5 px-4 py-3 text-left hover:bg-white/5 ${
              notification.is_read ? "opacity-70" : "bg-accent/5"
            }`}
          >
            <span className="text-sm text-slate-100">{notification.content}</span>
            <span className="text-xs text-slate-500">{formatTime(notification.created_at)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
