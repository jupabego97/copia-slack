import { useEffect, useRef, useState } from "react";
import socket from "../socket.js";

// ── Toolbar icon button ───────────────────────────────────────
function ToolBtn({ title, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded text-[#9B9EA4] hover:bg-[rgba(255,255,255,0.1)] hover:text-[#D1D2D3] transition"
    >
      {children}
    </button>
  );
}

export default function MessageInput({
  channelId,
  channelName,
  dmTarget,
  onSend,
  readOnly = false,
  typingUsers = [],
  error = "",
}) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef(null);
  const typingTimeout = useRef(null);

  // Reset on channel change
  useEffect(() => {
    setContent("");
    textareaRef.current?.focus();
  }, [channelId]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [content]);

  const emitTyping = () => {
    if (!channelId) return;
    socket.sendTyping(channelId);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => { typingTimeout.current = null; }, 1200);
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
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // ── Format helpers ────────────────────────────────────────
  const wrap = (before, after = before) => {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const selected = value.slice(s, e);
    const newVal = value.slice(0, s) + before + selected + after + value.slice(e);
    setContent(newVal);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(s + before.length, e + before.length);
    }, 0);
  };

  const typingLabel =
    typingUsers.length === 1
      ? `${typingUsers[0]} está escribiendo…`
      : typingUsers.length > 1
        ? `${typingUsers.slice(0, -1).join(", ")} y ${typingUsers.at(-1)} están escribiendo…`
        : "";

  const placeholder = dmTarget
    ? `Mensaje para ${dmTarget}`
    : channelName
      ? `Mensaje para #${channelName}`
      : "Escribe un mensaje";

  const canSend = !!content.trim() && !sending;

  return (
    <div className="shrink-0 px-4 pb-4 pt-2" style={{ background: "#222529" }}>
      {/* Typing indicator */}
      {typingLabel && (
        <div className="mb-1 flex items-center gap-1.5 px-1">
          <span className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-[#9B9EA4] animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </span>
          <span className="text-[12px] text-[#9B9EA4]">{typingLabel}</span>
        </div>
      )}

      {error && (
        <p className="mb-1 px-1 text-sm text-red-400">{error}</p>
      )}

      {readOnly ? (
        <div className="flex items-center gap-2.5 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[#9B9EA4]">
          <svg className="h-4 w-4 shrink-0 text-[#ECB22E]" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          Solo gerencia puede publicar en <span className="font-semibold text-[#D1D2D3]">#avisos</span>
        </div>
      ) : (
        <div className="composer-box">
          {/* ── Top toolbar ── */}
          <div className="flex items-center gap-0.5 border-b border-[rgba(255,255,255,0.08)] px-2 py-1.5">
            <ToolBtn title="Negrita (Ctrl+B)" onClick={() => wrap("**")}>
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h8a4 4 0 014 4 4 4 0 01-2.6 3.76A4 4 0 0118 16a4 4 0 01-4 4H6V4zm2 2v5h5.5a2.5 2.5 0 000-5H8zm0 7v5H14a2 2 0 000-4H8z" />
              </svg>
            </ToolBtn>
            <ToolBtn title="Cursiva (Ctrl+I)" onClick={() => wrap("_")}>
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10 4h4l-4 16H6l4-16zm4 0h4v2h-4V4zm-8 14H2v2h4v-2z" />
              </svg>
            </ToolBtn>
            <ToolBtn title="Tachado" onClick={() => wrap("~")}>
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 11h6v2H6v-2h6zm-4-5h8a2 2 0 012 2H6a2 2 0 012-2zm8 10H8a2 2 0 01-2-2h12a2 2 0 01-2 2z" />
              </svg>
            </ToolBtn>
            <ToolBtn title="Código inline" onClick={() => wrap("`")}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </ToolBtn>

            <span className="mx-1 h-4 w-px bg-[rgba(255,255,255,0.1)]" />

            <ToolBtn title="Lista numerada" onClick={() => setContent((v) => v + "\n1. ")}>
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 5h2V3H3v2zm0 4h2V7H3v2zm0 4h2v-2H3v2zm4-8h14V3H7v2zm0 4h14V7H7v2zm0 4h14v-2H7v2z" />
              </svg>
            </ToolBtn>
            <ToolBtn title="Lista con viñetas" onClick={() => setContent((v) => v + "\n• ")}>
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4zM2 6a1 1 0 110-2 1 1 0 010 2zm0 5a1 1 0 110-2 1 1 0 010 2zm0 5a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </ToolBtn>

            <span className="mx-1 h-4 w-px bg-[rgba(255,255,255,0.1)]" />

            <ToolBtn title="Mencionar a alguien" onClick={() => { setContent((v) => v + "@"); textareaRef.current?.focus(); }}>
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10h5v-2h-5c-4.34 0-8-3.66-8-8s3.66-8 8-8 8 3.66 8 8v1.43c0 .79-.71 1.57-1.5 1.57s-1.5-.78-1.5-1.57V12c0-2.76-2.24-5-5-5s-5 2.24-5 5 2.24 5 5 5c1.38 0 2.64-.56 3.54-1.47.65.89 1.77 1.47 2.96 1.47C19.05 22 21 20.05 21 17.43V12c0-5.52-4.48-10-9-10zm0 13c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" />
              </svg>
            </ToolBtn>
          </div>

          {/* ── Textarea ── */}
          <div className="px-3 py-2.5">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => { setContent(e.target.value); emitTyping(); }}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={placeholder}
              className="w-full resize-none bg-transparent text-[15px] leading-[22px] text-[#D1D2D3] outline-none placeholder:text-[#6B6F76]"
              style={{ minHeight: "22px", maxHeight: "200px", overflowY: "auto" }}
            />
          </div>

          {/* ── Bottom bar ── */}
          <div className="flex items-center justify-between border-t border-[rgba(255,255,255,0.08)] px-3 py-2">
            <div className="flex items-center gap-0.5">
              {/* Attachment placeholder */}
              <ToolBtn title="Adjuntar archivo">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </ToolBtn>
              {/* Emoji placeholder */}
              <ToolBtn title="Insertar emoji">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </ToolBtn>
            </div>

            {/* Send button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSend}
              className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
                canSend
                  ? "bg-[#007A5A] text-white hover:bg-[#148567] cursor-pointer"
                  : "bg-[rgba(255,255,255,0.08)] text-[#6B6F76] cursor-not-allowed"
              }`}
              title="Enviar mensaje"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2 .01 7z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <p className="mt-1.5 px-1 text-[11px] text-[#6B6F76]">
        <kbd className="rounded bg-[rgba(255,255,255,0.07)] px-1 py-px font-mono">Enter</kbd> enviar ·
        <kbd className="ml-1 rounded bg-[rgba(255,255,255,0.07)] px-1 py-px font-mono">Shift+Enter</kbd> nueva línea ·
        usa <span className="font-semibold text-[#9B9EA4]">@usuario</span> para mencionar
      </p>
    </div>
  );
}
