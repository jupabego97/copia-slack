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

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-6 py-4">
      {groups.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-slate-500">
          No hay mensajes todavía. ¡Sé el primero en escribir!
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={`${group.senderId}-${group.messages[0].id}`}>
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 font-semibold text-accent">
                  {group.sender.display_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-100">
                      {group.sender.display_name}
                      {group.sender.id === currentUserId && (
                        <span className="ml-1 text-xs text-slate-500">(tú)</span>
                      )}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${
                        ROLE_BADGES[group.sender.role]
                      }`}
                    >
                      {group.sender.role}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatTime(group.messages[0].created_at)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="ml-12 space-y-1">
                {group.messages.map((message) => (
                  <p
                    key={message.id}
                    className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-200"
                  >
                    {message.content}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
