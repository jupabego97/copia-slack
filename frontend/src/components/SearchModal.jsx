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

export default function SearchModal({ open, onClose, onSelectChannel, onSelectUser }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ channels: [], users: [], messages: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) { setQuery(""); setResults({ channels: [], users: [], messages: [] }); setError(""); return; }
    setTimeout(() => inputRef.current?.focus(), 50);
    const esc = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || query.trim().length < 2) { setResults({ channels: [], users: [], messages: [] }); return; }
    const timer = setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const res = await api.get("/api/search", { params: { q: query.trim() } });
        setResults(res.data);
      } catch (err) {
        setError(getErrorMessage(err, "No se pudo buscar."));
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [open, query]);

  if (!open) return null;

  const hasResults = results.channels.length > 0 || results.users.length > 0 || results.messages.length > 0;
  const showEmpty = !loading && !error && query.trim().length >= 2 && !hasResults;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-[10vh]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-[680px] overflow-hidden rounded-xl border border-[rgba(255,255,255,0.13)] shadow-2xl"
        style={{ background: "#222529" }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-[rgba(255,255,255,0.1)] px-4 py-3">
          <svg className="h-5 w-5 shrink-0 text-[#9B9EA4]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en Nanotronics Chat"
            className="flex-1 bg-transparent text-[16px] text-[#D1D2D3] outline-none placeholder:text-[#6B6F76]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(255,255,255,0.1)] text-[#9B9EA4] hover:text-white transition"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <kbd className="rounded bg-[rgba(255,255,255,0.08)] px-2 py-0.5 text-[12px] font-mono text-[#9B9EA4]">Esc</kbd>
        </div>

        <div className="max-h-[480px] overflow-y-auto p-2">
          {loading && (
            <div className="flex items-center justify-center py-8 gap-2 text-[13px] text-[#9B9EA4]">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[rgba(255,255,255,0.1)] border-t-[#9B9EA4]" />
              Buscando…
            </div>
          )}
          {error && <p className="px-3 py-4 text-sm text-red-400">{error}</p>}
          {showEmpty && (
            <div className="px-3 py-8 text-center text-[13px] text-[#9B9EA4]">
              No se encontraron resultados para <span className="font-bold text-[#D1D2D3]">"{query}"</span>
            </div>
          )}

          {!loading && query.trim().length < 2 && (
            <div className="px-3 py-6 text-center text-[13px] text-[#9B9EA4]">
              Escribe al menos 2 caracteres para buscar
            </div>
          )}

          {/* Channels */}
          {results.channels.length > 0 && (
            <section className="mb-2">
              <p className="px-3 py-2 text-[11px] font-extrabold uppercase tracking-wider text-[#9B9EA4]">Canales</p>
              {results.channels.map((ch) => (
                <button
                  key={`ch-${ch.id}`}
                  type="button"
                  onClick={() => { onSelectChannel(ch.id); onClose(); }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-[rgba(255,255,255,0.06)] transition"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded bg-[rgba(255,255,255,0.08)] text-[15px] font-bold text-[#9B9EA4]">#</span>
                  <span className="text-[14px] text-[#D1D2D3]">{highlightText(ch.name, query)}</span>
                </button>
              ))}
            </section>
          )}

          {/* People */}
          {results.users.length > 0 && (
            <section className="mb-2">
              <p className="px-3 py-2 text-[11px] font-extrabold uppercase tracking-wider text-[#9B9EA4]">Personas</p>
              {results.users.map((u) => {
                const [bg, fg] = avatarColor(u.display_name);
                return (
                  <button
                    key={`u-${u.id}`}
                    type="button"
                    onClick={() => { onSelectUser(u.id); onClose(); }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-[rgba(255,255,255,0.06)] transition"
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[11px] font-black"
                      style={{ background: bg, color: fg }}
                    >
                      {getInitials(u.display_name)}
                    </span>
                    <div>
                      <p className="text-[14px] text-[#D1D2D3]">{highlightText(u.display_name, query)}</p>
                      <p className="text-[12px] text-[#9B9EA4]">@{u.username}</p>
                    </div>
                    <span
                      className={`ml-auto h-2 w-2 rounded-full ${u.is_online ? "bg-[#2BAC76]" : "bg-[#6B6F76]"}`}
                    />
                  </button>
                );
              })}
            </section>
          )}

          {/* Messages */}
          {results.messages.length > 0 && (
            <section>
              <p className="px-3 py-2 text-[11px] font-extrabold uppercase tracking-wider text-[#9B9EA4]">Mensajes</p>
              {results.messages.map((msg) => (
                <button
                  key={`msg-${msg.id}`}
                  type="button"
                  onClick={() => { onSelectChannel(msg.channel_id); onClose(); }}
                  className="flex w-full flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left hover:bg-[rgba(255,255,255,0.06)] transition"
                >
                  <div className="flex items-center gap-1.5 text-[12px] text-[#9B9EA4]">
                    <span className="font-bold text-[#D1D2D3]">{msg.sender.display_name}</span>
                    <span>en</span>
                    <span className="text-[#1D9BD1]">#{msg.channel_name || "canal"}</span>
                  </div>
                  <p className="line-clamp-2 text-[13px] leading-5 text-[#9B9EA4]">
                    {highlightText(msg.content, query)}
                  </p>
                </button>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
