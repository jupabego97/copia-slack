import { useEffect, useRef, useState } from "react";
import api, { getErrorMessage } from "../api.js";
import { getInitials } from "../utils/format.js";
import { highlightText } from "../utils/highlight.jsx";

const AVATAR_COLORS = [
  ["#E01E5A", "#fff"], ["#ECB22E", "#1d1d1d"], ["#2EB67D", "#fff"],
  ["#36C5F0", "#1d1d1d"], ["#E8612D", "#fff"], ["#9C51B6", "#fff"], ["#1264A3", "#fff"],
];
function avatarColor(name = "") {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

export default function NewMessageModal({ open, onClose, onOpenDm, currentUserId }) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) { setQuery(""); setUsers([]); setError(""); return; }
    setTimeout(() => inputRef.current?.focus(), 50);

    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get("/api/users");
        setUsers(res.data);
      } catch (err) {
        setError(getErrorMessage(err, "No se pudieron cargar los usuarios."));
      } finally {
        setLoading(false);
      }
    };
    load();

    const esc = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);

  const filtered = users.filter((u) => u.id !== currentUserId).filter((u) => {
    const t = query.trim().toLowerCase();
    return !t || u.display_name.toLowerCase().includes(t) || u.username.toLowerCase().includes(t);
  });

  const handleSelect = async (userId) => {
    setLoading(true); setError("");
    try {
      const res = await api.post(`/api/users/${userId}/dm`);
      onOpenDm(res.data);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo abrir el mensaje directo."));
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-[10vh]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-[480px] overflow-hidden rounded-xl border border-[rgba(255,255,255,0.13)] shadow-2xl"
        style={{ background: "#222529" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.1)] px-4 py-3">
          <h3 className="text-[15px] font-extrabold text-white">Nuevo mensaje directo</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded text-[#9B9EA4] hover:bg-[rgba(255,255,255,0.08)] hover:text-white transition"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 border-b border-[rgba(255,255,255,0.1)] px-4 py-2.5">
          <span className="text-[13px] font-bold text-[#9B9EA4]">Para:</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar persona"
            className="flex-1 bg-transparent text-[14px] text-[#D1D2D3] outline-none placeholder:text-[#6B6F76]"
          />
        </div>

        {/* User list */}
        <div className="max-h-[360px] overflow-y-auto p-2">
          {loading && !users.length && (
            <div className="flex justify-center py-6">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[rgba(255,255,255,0.1)] border-t-[#9B9EA4]" />
            </div>
          )}
          {error && <p className="px-3 py-4 text-sm text-red-400">{error}</p>}

          {filtered.map((u) => {
            const [bg, fg] = avatarColor(u.display_name);
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => handleSelect(u.id)}
                disabled={loading}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-[rgba(255,255,255,0.06)] transition disabled:opacity-50"
              >
                <div className="relative shrink-0">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[12px] font-black"
                    style={{ background: bg, color: fg }}
                  >
                    {getInitials(u.display_name)}
                  </span>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#222529] ${
                      u.is_online ? "bg-[#2BAC76]" : "bg-[#6B6F76]"
                    }`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-[#D1D2D3]">
                    {highlightText(u.display_name, query)}
                  </p>
                  <p className="text-[12px] text-[#9B9EA4]">@{u.username}</p>
                </div>
                <span className={`text-[12px] font-medium ${u.is_online ? "text-[#2BAC76]" : "text-[#6B6F76]"}`}>
                  {u.is_online ? "Activo" : "Ausente"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
