import { useState } from "react";
import api from "../api.js";

export default function LoginForm({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/api/auth/login", { username, password });
      onLogin(res.data.user, res.data.access_token);
    } catch {
      setError("El nombre de usuario o la contraseña son incorrectos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-full flex-col items-center justify-center px-4 py-12"
      style={{ background: "#1A1D21" }}
    >
      {/* Logo mark */}
      <div className="mb-8 flex flex-col items-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl font-black text-white shadow-2xl"
          style={{ background: "#4A154B" }}
        >
          N
        </div>
        <h1 className="mt-4 text-[28px] font-black text-white tracking-tight">
          Nanotronics Chat
        </h1>
        <p className="mt-1 text-[15px] text-[#9B9EA4]">
          Inicia sesión en tu workspace
        </p>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-[400px] rounded-xl border border-[rgba(255,255,255,0.1)] p-8 shadow-2xl"
        style={{ background: "#222529" }}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="mb-1.5 block text-[13px] font-bold text-[#D1D2D3]"
            >
              Usuario
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="juan"
              required
              autoFocus
              className="w-full rounded-md border border-[rgba(255,255,255,0.13)] bg-[#1A1D21] px-3 py-2.5 text-[15px] text-[#D1D2D3] outline-none placeholder:text-[#6B6F76] focus:border-[#1264A3] focus:ring-1 focus:ring-[#1264A3] transition"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-[13px] font-bold text-[#D1D2D3]"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full rounded-md border border-[rgba(255,255,255,0.13)] bg-[#1A1D21] px-3 py-2.5 text-[15px] text-[#D1D2D3] outline-none placeholder:text-[#6B6F76] focus:border-[#1264A3] focus:ring-1 focus:ring-[#1264A3] transition"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-md py-2.5 text-[15px] font-bold text-white transition hover:brightness-110 disabled:opacity-60"
            style={{ background: "#4A154B" }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Iniciando sesión…
              </span>
            ) : (
              "Iniciar sesión"
            )}
          </button>
        </form>

      </div>

      <p className="mt-6 text-[12px] text-[#6B6F76]">
        © 2026 Nanotronics · Electrónica Colombia
      </p>
    </div>
  );
}
