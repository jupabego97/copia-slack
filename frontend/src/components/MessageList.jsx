import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api.js";
import MentionText from "./MentionText.jsx";
import { formatRelativeDate, formatTime, getInitials } from "../utils/format.js";

// ── Avatar colors (consistent per user) ──────────────────────
const AVATAR_COLORS = [
  ["#E01E5A", "#fff"],
  ["#ECB22E", "#1d1d1d"],
  ["#2EB67D", "#fff"],
  ["#36C5F0", "#1d1d1d"],
  ["#E8612D", "#fff"],
  ["#CC4400", "#fff"],
  ["#9C51B6", "#fff"],
  ["#1264A3", "#fff"],
];
function avatarColor(name = "") {
  const idx = (name.charCodeAt(0) || 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

// ── Group consecutive messages by same author (within 5 min) ─
function groupMessages(messages) {
  const groups = [];
  let cur = null;
  messages.forEach((msg) => {
    const same =
      cur &&
      cur.senderId === msg.sender_id &&
      new Date(msg.created_at) - new Date(cur.lastAt) < 5 * 60 * 1000;
    if (same) {
      cur.messages.push(msg);
      cur.lastAt = msg.created_at;
    } else {
      cur = { senderId: msg.sender_id, sender: msg.sender, messages: [msg], lastAt: msg.created_at };
      groups.push(cur);
    }
  });
  return groups;
}

function groupByDate(messages) {
  const sections = [];
  let curDate = null, curGroups = [];
  groupMessages(messages).forEach((g) => {
    const d = new Date(g.messages[0].created_at).toDateString();
    if (d !== curDate) {
      if (curGroups.length) sections.push({ date: curDate, groups: curGroups });
      curDate = d; curGroups = [g];
    } else {
      curGroups.push(g);
    }
  });
  if (curGroups.length) sections.push({ date: curDate, groups: curGroups });
  return sections;
}

// ── Hover action toolbar ──────────────────────────────────────
function MessageActions({ message, isMine, onEdit, onDelete }) {
  return (
    <div className="msg-actions">
      {/* React with emoji */}
      <button type="button" className="msg-action-btn" title="Reaccionar">
        <span>😊</span>
      </button>
      {/* Reply / thread placeholder */}
      <button type="button" className="msg-action-btn" title="Responder">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      </button>
      {isMine && (
        <>
          <button type="button" className="msg-action-btn" title="Editar" onClick={() => onEdit(message)}>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button type="button" className="msg-action-btn" title="Eliminar" onClick={() => onDelete(message.id)}>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

// ── Edit inline ───────────────────────────────────────────────
function EditInput({ initialContent, onSave, onCancel }) {
  const [value, setValue] = useState(initialContent);
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSave(value.trim()); }
    if (e.key === "Escape") onCancel();
  };

  return (
    <div className="mt-1">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={Math.max(1, value.split("\n").length)}
        className="w-full resize-none rounded-md border border-[#1264A3] bg-[#222529] px-3 py-2 text-[15px] leading-6 text-[#D1D2D3] outline-none"
      />
      <div className="mt-1 flex items-center gap-2 text-xs text-[#9B9EA4]">
        <span>Esc para cancelar ·</span>
        <button type="button" onClick={() => onSave(value.trim())} className="text-[#1D9BD1] hover:underline">
          Guardar cambios
        </button>
      </div>
    </div>
  );
}

export default function MessageList({ messages, currentUserId }) {
  const containerRef = useRef(null);
  const shouldStick = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const sections = useMemo(() => groupByDate(messages), [messages]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      shouldStick.current = dist < 80;
      setShowJump(dist > 200);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !shouldStick.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const jumpToBottom = () => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    shouldStick.current = true;
    setShowJump(false);
  };

  const handleEdit = async (msgId, newContent) => {
    if (!newContent) return;
    try {
      await api.patch(`/api/messages/${msgId}`, { content: newContent });
    } catch {/* error handled by WS update */}
    setEditingId(null);
  };

  const handleDelete = async (msgId) => {
    try {
      await api.delete(`/api/messages/${msgId}`);
    } catch {/* silent */}
  };

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-start justify-end px-5 pb-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[rgba(255,255,255,0.06)] text-3xl">
          #
        </div>
        <h3 className="mt-4 text-2xl font-black text-white">Este canal está tranquilo</h3>
        <p className="mt-1 text-sm text-[#9B9EA4]">
          Sé el primero en escribir. Usa <span className="font-semibold text-[#D1D2D3]">@usuario</span> para mencionar a alguien.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex-1">
      <div ref={containerRef} className="absolute inset-0 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.date}>
            {/* ── Date divider ── */}
            <div className="date-divider">
              <span>{formatRelativeDate(section.groups[0].messages[0].created_at)}</span>
            </div>

            {section.groups.map((group) => {
              const [bgColor, fgColor] = avatarColor(group.sender.display_name);
              return (
                <div key={`${group.senderId}-${group.messages[0].id}`}>
                  {group.messages.map((msg, idx) => {
                    const isFirst = idx === 0;
                    const isMine = msg.sender_id === currentUserId;
                    const isEditing = editingId === msg.id;

                    return (
                      <div
                        key={msg.id}
                        className={`message-row group ${isFirst ? "message-row-first" : ""}`}
                      >
                        {/* Avatar or time gutter */}
                        {isFirst ? (
                          <span
                            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[13px] font-black"
                            style={{ background: bgColor, color: fgColor }}
                          >
                            {getInitials(group.sender.display_name)}
                          </span>
                        ) : (
                          <span className="flex h-6 w-9 shrink-0 items-end justify-center">
                            <span className="hidden pb-0.5 text-[11px] leading-none text-[#6B6F76] group-hover:block">
                              {formatTime(msg.created_at)}
                            </span>
                          </span>
                        )}

                        {/* Content */}
                        <div className="min-w-0 flex-1 pb-0.5">
                          {isFirst && (
                            <div className="flex flex-wrap items-baseline gap-2 leading-none">
                              <span className="text-[15px] font-extrabold text-white hover:underline cursor-pointer">
                                {group.sender.display_name}
                              </span>
                              <span className="text-[12px] text-[#9B9EA4]">
                                {formatTime(msg.created_at)}
                              </span>
                            </div>
                          )}

                          {isEditing ? (
                            <EditInput
                              initialContent={msg.content}
                              onSave={(v) => handleEdit(msg.id, v)}
                              onCancel={() => setEditingId(null)}
                            />
                          ) : (
                            <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-[22px] text-[#D1D2D3]">
                              <MentionText text={msg.content} currentUserId={currentUserId} />
                              {msg.edited_at && (
                                <span className="ml-1 text-xs text-[#6B6F76]">(editado)</span>
                              )}
                            </p>
                          )}
                        </div>

                        {/* Hover action bar */}
                        {!isEditing && (
                          <MessageActions
                            message={msg}
                            isMine={isMine}
                            onEdit={() => setEditingId(msg.id)}
                            onDelete={handleDelete}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}

        {/* Bottom padding */}
        <div className="h-4" />
      </div>

      {showJump && (
        <button
          type="button"
          onClick={jumpToBottom}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.13)] bg-[#1A1D21] px-4 py-2 text-[13px] font-semibold text-[#D1D2D3] shadow-xl hover:bg-[#222529] transition"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          Ir al último mensaje
        </button>
      )}
    </div>
  );
}
