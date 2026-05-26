const ROLE_BADGES = {
  gerencia: "badge-gerencia",
  tecnico: "badge-tecnico",
  marketing: "badge-marketing",
  compras: "badge-compras",
  ventas: "badge-ventas",
};

function getDmLabel(channel, currentUserId) {
  const other = channel.members?.find((member) => member.id !== currentUserId);
  return other?.display_name || channel.name;
}

function getDmOnline(channel, currentUserId) {
  const other = channel.members?.find((member) => member.id !== currentUserId);
  return other?.is_online ?? false;
}

function getInitials(name) {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function Sidebar({
  user,
  channels,
  directMessages,
  activeChannelId,
  onSelectChannel,
  onLogout,
}) {
  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col bg-sidebar">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate font-mono text-base font-bold tracking-wide text-accent">
            NANOTRONICS
          </h1>
          <p className="truncate text-xs text-slate-500">Chat interno</p>
        </div>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase ${ROLE_BADGES[user.role]}`}
        >
          {user.role}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Canales
        </p>
        <nav className="space-y-0.5">
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
            </button>
          ))}
        </nav>

        <p className="mt-5 px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Mensajes directos
        </p>
        <nav className="space-y-0.5">
          {directMessages.map((channel) => {
            const online = getDmOnline(channel, user.id);
            const label = getDmLabel(channel, user.id);
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
              </button>
            );
          })}
        </nav>
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
