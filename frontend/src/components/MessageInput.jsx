import { useEffect, useRef, useState } from "react";
import socket from "../socket.js";

export default function MessageInput({
  channelId,
  channelName,
  onSend,
  readOnly = false,
  typingUsers = [],
  error = "",
}) {
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

  const placeholder = channelName
    ? `Escribe un mensaje en #${channelName}`
    : "Escribe un mensaje";

  return (
    <div className="border-t border-white/10 bg-main px-5 pb-5 pt-3">
      {typingLabel && (
        <p className="mb-2 px-1 text-xs text-accent">{typingLabel}</p>
      )}

      {error && <p className="mb-2 px-1 text-sm text-red-400">{error}</p>}

      {readOnly ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Solo gerencia puede escribir en #avisos.
        </div>
      ) : (
        <div className="composer-box">
          <textarea
            value={content}
            onChange={(event) => {
              setContent(event.target.value);
              emitTyping();
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={placeholder}
            className="max-h-36 min-h-[24px] flex-1 resize-none bg-transparent text-[15px] leading-6 text-slate-100 outline-none placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={sending || !content.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-slate-900 transition hover:brightness-110 disabled:opacity-40"
          >
            Enviar
          </button>
        </div>
      )}
    </div>
  );
}
