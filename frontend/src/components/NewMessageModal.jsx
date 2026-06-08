import { useEffect, useState } from "react";
import api, { getErrorMessage } from "../api.js";
import { getInitials } from "../utils/format.js";
import { highlightText } from "../utils/highlight.jsx";

export default function NewMessageModal({ open, onClose, onOpenDm }) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setQuery("");
      setUsers([]);
      setError("");
      return undefined;
    }

    const loadUsers = async () => {
      setLoading(true);
      try {
        const response = await api.get("/api/users");
        setUsers(response.data);
      } catch (err) {
        setError(getErrorMessage(err, "No se pudieron cargar los usuarios."));
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [open]);

  const filtered = users.filter((user) => {
    const term = query.trim().toLowerCase();
    if (!term) return true;
    return (
      user.display_name.toLowerCase().includes(term) ||
      user.username.toLowerCase().includes(term)
    );
  });

  const handleSelect = async (userId) => {
    setLoading(true);
    setError("");
    try {
      const response = await api.post(`/api/users/${userId}/dm`);
      onOpenDm(response.data);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo abrir el mensaje directo."));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-20">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-sidebar shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-100">Nuevo mensaje directo</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200">
            Esc
          </button>
        </div>

        <div className="border-b border-white/10 px-4 py-3">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar persona..."
            className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
          />
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {loading && <p className="px-3 py-4 text-sm text-slate-400">Cargando...</p>}
          {error && <p className="px-3 py-4 text-sm text-red-400">{error}</p>}
          {!loading &&
            filtered.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleSelect(user.id)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/5"
              >
                <span className="avatar text-xs">{getInitials(user.display_name)}</span>
                <div>
                  <p className="text-sm text-slate-100">
                    {highlightText(user.display_name, query)}
                  </p>
                  <p className="text-xs text-slate-500">@{user.username}</p>
                </div>
                <span
                  className={`ml-auto h-2.5 w-2.5 rounded-full ${
                    user.is_online ? "bg-emerald-400" : "bg-slate-600"
                  }`}
                />
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
