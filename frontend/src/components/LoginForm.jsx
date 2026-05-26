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
    <div className="flex min-h-full items-center justify-center bg-sidebar px-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 shadow-2xl lg:grid-cols-2">
        <div className="hidden flex-col justify-between bg-main p-10 lg:flex">
          <div>
            <h1 className="font-mono text-3xl font-bold tracking-wide text-accent">NANOTRONICS</h1>
            <p className="mt-4 text-lg text-slate-300">Tu workspace de equipo</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Canales por área, mensajes directos y avisos en tiempo real para todo el equipo.
            </p>
          </div>
          <div className="space-y-2 text-sm text-slate-500">
            <p># general · ventas · tecnico · compras</p>
            <p>Contraseña demo: nanotronics123</p>
          </div>
        </div>

        <div className="bg-sidebar p-8 sm:p-10">
          <div className="mb-8 lg:hidden">
            <h1 className="font-mono text-2xl font-bold tracking-wide text-accent">NANOTRONICS</h1>
          </div>

          <h2 className="text-xl font-semibold text-slate-100">Inicia sesión</h2>
          <p className="mt-1 text-sm text-slate-400">Accede con tu usuario interno</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300" htmlFor="username">
                Usuario
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-main px-3 py-2.5 text-slate-100 outline-none ring-accent/40 focus:border-accent focus:ring-2"
                placeholder="juan"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300" htmlFor="password">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-main px-3 py-2.5 text-slate-100 outline-none ring-accent/40 focus:border-accent focus:ring-2"
                placeholder="••••••••"
                required
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-accent px-4 py-2.5 font-semibold text-slate-900 transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? "Ingresando..." : "Entrar al workspace"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
