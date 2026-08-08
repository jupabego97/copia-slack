import { useCallback, useEffect, useState } from "react";
import api, { setAuthExpiredHandler } from "./api.js";
import Chat from "./pages/Chat.jsx";
import LoginForm from "./components/LoginForm.jsx";
import socket from "./socket.js";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    socket.disconnect();
    setUser(null);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get("/api/auth/me")
      .then((response) => {
        setUser(response.data);
        socket.connect(token);
      })
      .catch(() => {
        localStorage.removeItem("token");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => setAuthExpiredHandler(() => {
    socket.disconnect();
    setUser(null);
    setLoading(false);
  }), []);

  const handleLogin = (loggedUser, token) => {
    localStorage.setItem("token", token);
    setUser(loggedUser);
    socket.connect(token);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-main text-slate-300">
        Cargando Nanotronics Chat...
      </div>
    );
  }

  if (!user) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return <Chat user={user} onLogout={logout} />;
}
