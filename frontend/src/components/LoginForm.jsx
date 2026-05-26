import { useState } from "react";
import api from "../api.js";

export default function LoginForm({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/api/auth/login", { username, password });
      onLogin(response.data.user, response.data.access_token);
    } catch {
      setError("Usuario o contraseña incorrectos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-main px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-sidebar p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="font-mono text-2xl font-bold tracking-wide text-accent">
            NANOTRONICS
          </h1>
          <p className="mt-2 text-sm text-slate-400">Mensajería interna del equipo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-slate-300" htmlFor="username">
              Usuario
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-main px-3 py-2 text-slate-100 outline-none focus:border-accent"
              placeholder="juan"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-main px-3 py-2 text-slate-100 outline-none focus:border-accent"
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent px-4 py-2 font-semibold text-slate-900 transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Usuarios demo: juan, carlos, laura, miguel, sofia, andres
        </p>
      </div>
    </div>
  );
}
