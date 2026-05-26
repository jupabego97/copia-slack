import { useEffect, useMemo, useRef } from "react";

const ROLE_BADGES = {
  gerencia: "badge-gerencia",
  tecnico: "badge-tecnico",
  marketing: "badge-marketing",
  compras: "badge-compras",
  ventas: "badge-ventas",
};

function formatTime(value) {
  return new Date(value).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name) {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function groupMessages(messages) {
  const groups = [];
  let currentGroup = null;

  messages.forEach((message) => {
    const sameAuthor =
      currentGroup &&
      currentGroup.senderId === message.sender_id &&
      new Date(message.created_at) - new Date(currentGroup.lastCreatedAt) < 5 * 60 * 1000;

    if (sameAuthor) {
      currentGroup.messages.push(message);
      currentGroup.lastCreatedAt = message.created_at;
    } else {
      currentGroup = {
        senderId: message.sender_id,
        sender: message.sender,
        messages: [message],
        lastCreatedAt: message.created_at,
      };
      groups.push(currentGroup);
    }
  });

  return groups;
}

export default function MessageList({ messages, currentUserId }) {
  const containerRef = useRef(null);
  const shouldStickToBottom = useRef(true);

  const groups = useMemo(() => groupMessages(messages), [messages]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      shouldStickToBottom.current = distanceFromBottom < 80;
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !shouldStickToBottom.current) return;
    container.scrollTop = container.scrollHeight;
  }, [messages]);

  if (groups.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-2xl">
          #
        </div>
        <p className="text-base font-semibold text-slate-200">Este canal está tranquilo</p>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          Sé el primero en escribir. Los mensajes del equipo aparecerán aquí.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto">
      {groups.map((group) => (
        <div key={`${group.senderId}-${group.messages[0].id}`}>
          {group.messages.map((message, index) => {
            const isFirst = index === 0;
            return (
              <div
                key={message.id}
                className={`group message-row ${isFirst ? "message-row-first" : ""}`}
              >
                {isFirst ? (
                  <div className="avatar">{getInitials(group.sender.display_name)}</div>
                ) : (
                  <div className="w-9 shrink-0" />
                )}

                <div className="min-w-0 flex-1 pb-1">
                  {isFirst && (
                    <div className="mb-0.5 flex flex-wrap items-baseline gap-2">
                      <span className="font-bold text-slate-100">
                        {group.sender.display_name}
                        {group.sender.id === currentUserId && (
                          <span className="ml-1 text-xs font-normal text-slate-500">(tú)</span>
                        )}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${
                          ROLE_BADGES[group.sender.role]
                        }`}
                      >
                        {group.sender.role}
                      </span>
                      <span className="text-xs text-slate-500 opacity-0 transition group-hover:opacity-100">
                        {formatTime(message.created_at)}
                      </span>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap break-words text-[15px] leading-6 text-slate-200">
                    {message.content}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
