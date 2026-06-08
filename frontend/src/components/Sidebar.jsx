import { useState } from "react";
import { formatTime, getDmLabel, getInitials } from "../utils/format.js";

const ROLE_BADGES = {
  gerencia: "badge-gerencia",
  tecnico: "badge-tecnico",
  marketing: "badge-marketing",
  compras: "badge-compras",
  ventas: "badge-ventas",
};

function Section({ title, collapsed, onToggle, children }) {
  return (
    <section className="mb-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-300"
      >
        <span>{title}</span>
        <span>{collapsed ? "+" : "−"}</span>
      </button>
      {!collapsed && <div className="mt-1 space-y-0.5">{children}</div>}
    </section>
  );
}

function UnreadBadge({ count }) {
  if (!count) return null;
  return (
    <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-slate-900">
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

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col bg-sidebar">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate font-mono text-base font-bold tracking-wide text-accent">
            NANOTRONICS
          </h1>
          <p className="truncate text-xs text-slate-500">Workspace interno</p>
        </div>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase ${ROLE_BADGES[user.role]}`}
        >
          {user.role}
        </span>
      </div>

      <div className="border-b border-white/10 px-3 py-2">
        <button
          type="button"
          onClick={onNewMessage}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/10"
        >
          + Nuevo mensaje
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <Section
          title="Canales"
          collapsed={!channelsOpen}
          onToggle={() => setChannelsOpen((value) => !value)}
        >
          {channels.map((channel) => (
            <button
              key={channel.id}
              type="button"
              onClick={() => onSelectChannel(channel.id)}
              className={`channel-item ${
                activeChannelId === channel.id ? "channel-item-active" : "channel-item-idle"
              }`}
            >
              <span className={activeChannelId === channel.id ? "opacity-70" : "text-slate-500"}>
                #
              </span>
              <span className="truncate">{channel.name}</span>
              <UnreadBadge count={channel.unread_count} />
            </button>
          ))}
        </Section>

        <Section
          title="Mensajes directos"
          collapsed={!dmsOpen}
          onToggle={() => setDmsOpen((value) => !value)}
        >
          {directMessages.map((channel) => {
            const label = getDmLabel(channel, user.id);
            const other = channel.members?.find((member) => member.id !== user.id);
            const online = other?.is_online ?? false;
            return (
              <button
                key={channel.id}
                type="button"
                onClick={() => onSelectChannel(channel.id)}
                className={`channel-item ${
                  activeChannelId === channel.id ? "channel-item-active" : "channel-item-idle"
                }`}
              >
                <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-[10px] font-semibold">
                    {getInitials(label)}
                  </span>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar ${
                      online ? "bg-emerald-400" : "bg-slate-600"
                    }`}
                  />
                </span>
                <span className="truncate">{label}</span>
                <UnreadBadge count={channel.unread_count} />
              </button>
            );
          })}
        </Section>
      </div>

      <div className="border-t border-white/10 p-3">
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
          <div className="avatar text-xs">{getInitials(user.display_name)}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-200">{user.display_name}</p>
            <p className="truncate text-xs text-slate-500">@{user.username}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="w-full rounded-md px-3 py-1.5 text-sm text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
