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

export default function Sidebar({
  user,
  channels,
  directMessages,
  activeChannelId,
  onSelectChannel,
  onLogout,
}) {
  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col bg-sidebar">
      <div className="border-b border-white/10 px-4 py-5">
        <h1 className="font-mono text-lg font-bold tracking-wide text-accent">NANOTRONICS</h1>
        <p className="mt-1 truncate text-xs text-slate-400">{user.display_name}</p>
        <span className={`mt-2 inline-block rounded px-2 py-0.5 text-[10px] uppercase ${ROLE_BADGES[user.role]}`}>
          {user.role}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-4">
        <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Canales
        </p>
        <div className="mt-2 space-y-1">
          {channels.map((channel) => (
            <button
              key={channel.id}
              type="button"
              onClick={() => onSelectChannel(channel.id)}
              className={`flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm transition ${
                activeChannelId === channel.id
                  ? "bg-accent font-semibold text-slate-900"
                  : "text-slate-300 hover:bg-white/5"
              }`}
            >
              <span className="mr-1 text-slate-500">#</span>
              {channel.name}
            </button>
          ))}
        </div>

        <p className="mt-6 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Mensajes directos
        </p>
        <div className="mt-2 space-y-1">
          {directMessages.map((channel) => {
            const online = getDmOnline(channel, user.id);
            return (
              <button
                key={channel.id}
                type="button"
                onClick={() => onSelectChannel(channel.id)}
                className={`flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm transition ${
                  activeChannelId === channel.id
                    ? "bg-accent font-semibold text-slate-900"
                    : "text-slate-300 hover:bg-white/5"
                }`}
              >
                <span
                  className={`mr-2 h-2 w-2 rounded-full ${
                    online ? "bg-emerald-400" : "bg-slate-500"
                  }`}
                />
                {getDmLabel(channel, user.id)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={onLogout}
          className="w-full rounded-md border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
