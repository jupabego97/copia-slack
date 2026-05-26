import { useEffect, useRef, useState } from "react";
import socket from "../socket.js";

export default function MessageInput({ channelId, onSend, readOnly = false, typingUsers = [] }) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const typingTimeout = useRef(null);

  useEffect(() => {
    setContent("");
  }, [channelId]);

  const emitTyping = () => {
    if (!channelId) return;
    socket.sendTyping(channelId);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      typingTimeout.current = null;
    }, 1200);
  };

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed || sending || readOnly) return;

    setSending(true);
    try {
      await onSend(trimmed);
      setContent("");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const typingLabel =
    typingUsers.length === 1
      ? `${typingUsers[0]} está escribiendo...`
      : typingUsers.length > 1
        ? `${typingUsers.join(", ")} están escribiendo...`
        : "";

  return (
    <div className="border-t border-white/10 bg-main px-6 py-4">
      {typingLabel && (
        <p className="mb-2 text-xs italic text-accent">{typingLabel}</p>
      )}

      {readOnly ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Solo gerencia puede escribir en este canal.
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-sidebar/60 p-3">
          <textarea
            value={content}
            onChange={(event) => {
              setContent(event.target.value);
              emitTyping();
            }}
            onKeyDown={handleKeyDown}
            rows={3}
            placeholder="Escribe un mensaje... (Enter para enviar, Shift+Enter para nueva línea)"
            className="w-full resize-none bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={sending || !content.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-slate-900 transition hover:brightness-110 disabled:opacity-50"
            >
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
