import { useEffect, useRef, useState } from "react";
import api, { getErrorMessage } from "../api.js";
import { formatTime } from "../utils/format.js";

export default function NotificationPanel({ open, onClose, onOpenChannel }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const panelRef = useRef(null);

  const load = async () => {
    setLoading(true); setError("");
    try {
      const res = await api.get("/api/notifications");
      setNotifications(res.data);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudieron cargar las notificaciones."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) load(); }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  const handleOpen = async (n) => {
    try { await api.post(`/api/notifications/${n.id}/read`); } catch {/* silent */}
    onOpenChannel(n.channel_id);
    onClose();
  };

  const handleReadAll = async () => {
    try {
      await api.post("/api/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      setError(getErrorMessage(err, "No se pudieron marcar como leídas."));
    }
  };

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-[calc(100%+6px)] z-50 w-[380px] overflow-hidden rounded-xl border border-[rgba(255,255,255,0.13)] shadow-2xl"
      style={{ background: "#222529" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.1)] px-4 py-3">
        <h3 className="text-[14px] font-extrabold text-white">Menciones y reacciones</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReadAll}
            className="text-[12px] text-[#1D9BD1] hover:underline"
          >
            Marcar todas como leídas
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded text-[#9B9EA4] hover:bg-[rgba(255,255,255,0.08)] hover:text-white transition"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-[420px] overflow-y-auto">
        {loading && (
          <div className="flex justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[rgba(255,255,255,0.1)] border-t-[#9B9EA4]" />
          </div>
        )}
        {error && <p className="px-4 py-6 text-sm text-red-400">{error}</p>}
        {!loading && notifications.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <svg className="h-10 w-10 text-[#6B6F76]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-sm font-semibold text-[#9B9EA4]">Sin notificaciones</p>
            <p className="text-[12px] text-[#6B6F76]">Te avisaremos cuando alguien te mencione.</p>
          </div>
        )}

        {notifications.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => handleOpen(n)}
            className={`flex w-full items-start gap-3 border-b border-[rgba(255,255,255,0.06)] px-4 py-3 text-left hover:bg-[rgba(255,255,255,0.04)] transition ${
              !n.is_read ? "bg-[#1264A3]/10" : ""
            }`}
          >
            {!n.is_read && (
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#1D9BD1]" />
            )}
            {n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-5 text-[#D1D2D3]">{n.content}</p>
              <p className="mt-0.5 text-[11px] text-[#6B6F76]">{formatTime(n.created_at)}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
