import { useState } from "react";
import { getDmLabel, getInitials } from "../utils/format.js";

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
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function Avatar({ name, size = "sm" }) {
  const [bg, fg] = avatarColor(name);
  const cls = size === "sm"
    ? "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded text-[10px] font-black"
    : "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-black";
  return (
    <span className={cls} style={{ background: bg, color: fg }}>
      {getInitials(name)}
    </span>
  );
}

function SectionHeader({ title, open, onToggle, onAction, actionLabel }) {
  return (
    <div className="group flex items-center gap-1 px-3 py-1">
      <button
        type="button"
        onClick={onToggle}
        className="flex flex-1 items-center gap-1 text-[13px] font-extrabold text-[#C9B4CA] hover:text-white transition-colors"
      >
        <svg
          className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
          fill="currentColor"
          viewBox="0 0 6 10"
        >
          <path d="M1 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
        {title}
      </button>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          title={actionLabel}
          className="opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded text-[#C9B4CA] hover:text-white hover:bg-[rgba(255,255,255,0.08)] transition"
        >
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 4a1 1 0 011 1v4h4a1 1 0 010 2h-4v4a1 1 0 01-2 0v-4H5a1 1 0 010-2h4V5a1 1 0 011-1z" />
          </svg>
        </button>
      )}
    </div>
  );
}

function UnreadBadge({ count }) {
  if (!count) return null;
  return (
    <span className="ml-auto shrink-0 rounded-full bg-white px-1.5 py-px text-[11px] font-black text-[#19171D] leading-4">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function Sidebar({
  user,
  channels,
  directMessages,
  activeChannelId,
  onSelectChannel,
  onNewMessage,
  onLogout,
}) {
  const [channelsOpen, setChannelsOpen] = useState(true);
  const [dmsOpen, setDmsOpen] = useState(true);

  const [bg, fg] = avatarColor(user.display_name);

  return (
    <aside
      className="flex h-full w-[260px] shrink-0 flex-col border-r border-[rgba(255,255,255,0.08)]"
      style={{ background: "#19171D" }}
    >
      {/* ── Workspace header ── */}
      <div className="flex h-[49px] shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.08)] px-4">
        <button
          type="button"
          className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-[rgba(255,255,255,0.08)] transition"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#4A154B] text-[10px] font-black text-white">N</span>
          <span className="truncate text-[15px] font-extrabold text-white leading-none">Nanotronics</span>
          <svg className="h-3.5 w-3.5 shrink-0 text-[#9B9EA4]" fill="currentColor" viewBox="0 0 20 20">
            <path d="M5 8l5 5 5-5H5z" />
          </svg>
        </button>

        {/* Compose new message */}
        <button
          type="button"
          onClick={onNewMessage}
          title="Nuevo mensaje directo"
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[rgba(255,255,255,0.1)] transition text-[#C9B4CA] hover:text-white"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      </div>

      {/* ── Navigation list ── */}
      <div className="flex-1 overflow-y-auto py-3">

        {/* Channels */}
        <div className="mb-1">
          <SectionHeader
            title="Canales"
            open={channelsOpen}
            onToggle={() => setChannelsOpen((v) => !v)}
            actionLabel="Explorar canales"
          />
          {channelsOpen && (
            <ul className="mt-0.5">
              {channels.map((ch) => {
                const active = activeChannelId === ch.id;
                const hasUnread = ch.unread_count > 0;
                return (
                  <li key={ch.id}>
                    <button
                      type="button"
                      onClick={() => onSelectChannel(ch.id)}
                      className={`channel-item ${active ? "channel-item-active" : `channel-item-idle${hasUnread ? " has-unread" : ""}`}`}
                    >
                      <span className={`text-[16px] leading-none ${active ? "text-white opacity-80" : hasUnread ? "text-white opacity-70" : "text-[#9B9EA4]"}`}>#</span>
                      <span className="truncate">{ch.name}</span>
                      <UnreadBadge count={ch.unread_count} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Direct Messages */}
        <div className="mt-2">
          <SectionHeader
            title="Mensajes directos"
            open={dmsOpen}
            onToggle={() => setDmsOpen((v) => !v)}
            actionLabel="Nuevo mensaje directo"
            onAction={onNewMessage}
          />
          {dmsOpen && (
            <ul className="mt-0.5">
              {directMessages.map((ch) => {
                const active = activeChannelId === ch.id;
                const label = getDmLabel(ch, user.id);
                const other = ch.members?.find((m) => m.id !== user.id);
                const online = other?.is_online ?? false;
                const hasUnread = ch.unread_count > 0;
                return (
                  <li key={ch.id}>
                    <button
                      type="button"
                      onClick={() => onSelectChannel(ch.id)}
                      className={`channel-item ${active ? "channel-item-active" : `channel-item-idle${hasUnread ? " has-unread" : ""}`}`}
                    >
                      <span className="relative mr-0.5 shrink-0">
                        <Avatar name={label} size="sm" />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 ${
                            active ? "border-[rgba(255,255,255,0.16)]" : "border-[#19171D]"
                          } ${online ? "bg-[#2BAC76]" : "bg-transparent border-[#9B9EA4]"}`}
                          style={!online ? { boxShadow: "inset 0 0 0 1.5px #9B9EA4" } : {}}
                        />
                      </span>
                      <span className="truncate">{label}</span>
                      <UnreadBadge count={ch.unread_count} />
                    </button>
                  </li>
                );
              })}
              {directMessages.length === 0 && (
                <li>
                  <button
                    type="button"
                    onClick={onNewMessage}
                    className="channel-item channel-item-idle"
                  >
                    <span className="text-[#9B9EA4]">+</span>
                    <span className="text-[#9B9EA4]">Añadir compañero</span>
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* ── User footer ── */}
      <div className="shrink-0 border-t border-[rgba(255,255,255,0.08)] px-2 py-2">
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[rgba(255,255,255,0.08)] transition group cursor-pointer">
          <div className="relative shrink-0">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black"
              style={{ background: bg, color: fg }}
            >
              {getInitials(user.display_name)}
            </span>
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#19171D] bg-[#2BAC76]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-bold text-white leading-tight">
              {user.display_name}
            </p>
            <p className="truncate text-[12px] text-[#9B9EA4] leading-tight">Activo</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            title="Cerrar sesión"
            className="opacity-0 group-hover:opacity-100 flex h-6 w-6 items-center justify-center rounded text-[#9B9EA4] hover:text-white hover:bg-[rgba(255,255,255,0.1)] transition"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
