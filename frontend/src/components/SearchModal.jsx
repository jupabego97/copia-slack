import { useEffect, useState } from "react";
import api, { getErrorMessage } from "../api.js";
import { getInitials } from "../utils/format.js";
import { highlightText } from "../utils/highlight.jsx";

export default function SearchModal({ open, onClose, onSelectChannel, onSelectUser }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ channels: [], users: [], messages: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults({ channels: [], users: [], messages: [] });
      setError("");
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults({ channels: [], users: [], messages: [] });
      return undefined;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await api.get("/api/search", { params: { q: query.trim() } });
        setResults(response.data);
      } catch (err) {
        setError(getErrorMessage(err, "No se pudo buscar."));
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [open, query]);

  if (!open) return null;

  const hasResults =
    results.channels.length > 0 || results.users.length > 0 || results.messages.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-20">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-sidebar shadow-2xl">
        <div className="border-b border-white/10 px-4 py-3">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar canales, personas o mensajes..."
            className="w-full bg-transparent text-base text-slate-100 outline-none placeholder:text-slate-500"
          />
        </div>

        <div className="max-h-[420px] overflow-y-auto p-2">
          {loading && <p className="px-3 py-4 text-sm text-slate-400">Buscando...</p>}
          {error && <p className="px-3 py-4 text-sm text-red-400">{error}</p>}
          {!loading && !error && query.trim().length >= 2 && !hasResults && (
            <p className="px-3 py-4 text-sm text-slate-400">Sin resultados para “{query}”.</p>
          )}

          {results.channels.length > 0 && (
            <section className="mb-3">
              <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Canales
              </p>
              {results.channels.map((channel) => (
                <button
                  key={`channel-${channel.id}`}
                  type="button"
                  onClick={() => {
                    onSelectChannel(channel.id);
                    onClose();
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/5"
                >
                  <span className="text-slate-500">#</span>
                  <span className="text-sm text-slate-200">{highlightText(channel.name, query)}</span>
                </button>
              ))}
            </section>
          )}

          {results.users.length > 0 && (
            <section className="mb-3">
              <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Personas
              </p>
              {results.users.map((user) => (
                <button
                  key={`user-${user.id}`}
                  type="button"
                  onClick={() => {
                    onSelectUser(user.id);
                    onClose();
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/5"
                >
                  <span className="avatar text-xs">{getInitials(user.display_name)}</span>
                  <span className="text-sm text-slate-200">
                    {highlightText(user.display_name, query)}
                  </span>
                </button>
              ))}
            </section>
          )}

          {results.messages.length > 0 && (
            <section>
              <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Mensajes
              </p>
              {results.messages.map((message) => (
                <button
                  key={`message-${message.id}`}
                  type="button"
                  onClick={() => {
                    onSelectChannel(message.channel_id);
                    onClose();
                  }}
                  className="flex w-full flex-col rounded-lg px-3 py-2 text-left hover:bg-white/5"
                >
                  <span className="text-xs text-slate-500">{message.sender.display_name}</span>
                  <span className="text-sm text-slate-200">
                    {highlightText(message.content, query)}
                  </span>
                </button>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
