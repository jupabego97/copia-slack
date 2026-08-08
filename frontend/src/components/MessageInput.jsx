import { useEffect, useMemo, useRef, useState } from "react";
import socket from "../socket.js";

function ToolBtn({ title, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
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
  members = [],
  currentUserId,
  onSend,
  readOnly = false,
  typingUsers = [],
  error = "",
  replyingTo = null,
  onCancelReply,
}) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef(null);
  const typingTimeout = useRef(null);

  useEffect(() => {
    setContent("");
    setMentionOpen(false);
    textareaRef.current?.focus();
  }, [channelId]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [content]);

  const mentionCandidates = useMemo(() => {
    if (!mentionOpen) return [];
    const q = mentionQuery.toLowerCase();
    return members
      .filter((m) => m.id !== currentUserId)
      .filter(
        (m) =>
          !q ||
          m.username.toLowerCase().includes(q) ||
          m.display_name.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [mentionOpen, mentionQuery, members, currentUserId]);

  useEffect(() => {
    setMentionIndex(0);
  }, [mentionQuery, mentionOpen]);

  const detectMention = (value, cursor) => {
    const before = value.slice(0, cursor);
    const match = before.match(/(^|\s)@([a-zA-Z0-9_]*)$/);
    if (!match) {
      setMentionOpen(false);
      setMentionQuery("");
      return;
    }
    setMentionOpen(true);
    setMentionQuery(match[2] || "");
  };

  const insertMention = (username) => {
    const el = textareaRef.current;
    if (!el) return;
    const cursor = el.selectionStart;
    const before = content.slice(0, cursor);
    const after = content.slice(cursor);
    const replaced = before.replace(/(^|\s)@([a-zA-Z0-9_]*)$/, `$1@${username} `);
    setContent(replaced + after);
    setMentionOpen(false);
    setMentionQuery("");
    setTimeout(() => {
      el.focus();
      const pos = replaced.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  };

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
    setMentionOpen(false);
    try {
      await onSend(trimmed, replyingTo);
      setContent("");
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      wrap("**");
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
      e.preventDefault();
      wrap("_");
      return;
    }

    if (mentionOpen && mentionCandidates.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionCandidates.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(mentionCandidates[mentionIndex].username);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionOpen(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

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

      {error && <p className="mb-1 px-1 text-sm text-red-400">{error}</p>}

      {replyingTo && (
        <div className="mb-1 flex items-start gap-2 rounded-lg border border-[#36C5F0]/25 bg-[#36C5F0]/10 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[#36C5F0]">Respondiendo a {replyingTo.sender.display_name}</p>
            <p className="mt-0.5 truncate text-xs text-[#9B9EA4]">{replyingTo.content}</p>
          </div>
          <button type="button" onClick={onCancelReply} aria-label="Cancelar respuesta" className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#9B9EA4] hover:bg-white/10 hover:text-white">
            <span aria-hidden="true">×</span>
          </button>
        </div>
      )}

      {readOnly ? (
        <div className="flex items-center gap-2.5 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[#9B9EA4]">
          <svg className="h-4 w-4 shrink-0 text-[#ECB22E]" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          Solo gerencia puede publicar en <span className="font-semibold text-[#D1D2D3]">#avisos</span>
        </div>
      ) : (
        <div className="composer-box relative">
          {mentionOpen && mentionCandidates.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-1 overflow-hidden rounded-lg border border-[rgba(255,255,255,0.13)] bg-[#1A1D21] shadow-xl">
              <p className="border-b border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#9B9EA4]">
                Mencionar
              </p>
              {mentionCandidates.map((user, idx) => (
                <button
                  key={user.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(user.username);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] transition ${
                    idx === mentionIndex
                      ? "bg-[rgba(255,255,255,0.1)] text-white"
                      : "text-[#D1D2D3] hover:bg-[rgba(255,255,255,0.06)]"
                  }`}
                >
                  <span className="font-bold">@{user.username}</span>
                  <span className="text-[#9B9EA4]">{user.display_name}</span>
                </button>
              ))}
            </div>
          )}

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

            <ToolBtn
              title="Mencionar a alguien"
              onClick={() => {
                const el = textareaRef.current;
                const next = `${content}@`;
                setContent(next);
                setMentionOpen(true);
                setMentionQuery("");
                setTimeout(() => {
                  el?.focus();
                  const pos = next.length;
                  el?.setSelectionRange(pos, pos);
                }, 0);
              }}
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10h5v-2h-5c-4.34 0-8-3.66-8-8s3.66-8 8-8 8 3.66 8 8v1.43c0 .79-.71 1.57-1.5 1.57s-1.5-.78-1.5-1.57V12c0-2.76-2.24-5-5-5s-5 2.24-5 5 2.24 5 5 5c1.38 0 2.64-.56 3.54-1.47.65.89 1.77 1.47 2.96 1.47C19.05 22 21 20.05 21 17.43V12c0-5.52-4.48-10-9-10zm0 13c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" />
              </svg>
            </ToolBtn>
          </div>

          <div className="px-3 py-2.5">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => {
                const value = e.target.value;
                setContent(value);
                emitTyping();
                detectMention(value, e.target.selectionStart);
              }}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={placeholder}
              className="w-full resize-none bg-transparent text-[15px] leading-[22px] text-[#D1D2D3] outline-none placeholder:text-[#6B6F76]"
              style={{ minHeight: "22px", maxHeight: "200px", overflowY: "auto" }}
            />
          </div>

          <div className="flex items-center justify-end border-t border-[rgba(255,255,255,0.08)] px-3 py-2">
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
