import { useEffect, useMemo, useRef, useState } from "react";
import MentionText from "./MentionText.jsx";
import { formatRelativeDate, formatTime, getInitials } from "../utils/format.js";

const ROLE_BADGES = {
  gerencia: "badge-gerencia",
  tecnico: "badge-tecnico",
  marketing: "badge-marketing",
  compras: "badge-compras",
  ventas: "badge-ventas",
};

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

function groupByDate(messages) {
  const sections = [];
  let currentDate = null;
  let currentGroups = [];

  groupMessages(messages).forEach((group) => {
    const dateKey = new Date(group.messages[0].created_at).toDateString();
    if (dateKey !== currentDate) {
      if (currentGroups.length > 0) {
        sections.push({ date: currentDate, groups: currentGroups });
      }
      currentDate = dateKey;
      currentGroups = [group];
    } else {
      currentGroups.push(group);
    }
  });

  if (currentGroups.length > 0) {
    sections.push({ date: currentDate, groups: currentGroups });
  }

  return sections;
}

export default function MessageList({ messages, currentUserId }) {
  const containerRef = useRef(null);
  const shouldStickToBottom = useRef(true);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);

  const sections = useMemo(() => groupByDate(messages), [messages]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      shouldStickToBottom.current = distanceFromBottom < 80;
      setShowJumpToBottom(distanceFromBottom > 160);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !shouldStickToBottom.current) return;
    container.scrollTop = container.scrollHeight;
  }, [messages]);

  const jumpToBottom = () => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
    shouldStickToBottom.current = true;
    setShowJumpToBottom(false);
  };

  if (messages.length === 0) {
    return (
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-2xl">
          #
        </div>
        <p className="text-base font-semibold text-slate-200">Este canal está tranquilo</p>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          Escribe el primer mensaje o menciona a alguien con @usuario.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex-1">
      <div ref={containerRef} className="absolute inset-0 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.date}>
            <div className="sticky top-0 z-10 flex justify-center py-4">
              <span className="rounded-full border border-white/10 bg-main/95 px-3 py-1 text-xs text-slate-400">
                {formatRelativeDate(section.groups[0].messages[0].created_at)}
              </span>
            </div>

            {section.groups.map((group) => (
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
                          <MentionText text={message.content} />
                        </p>
                        {message.edited_at && (
                          <span className="text-xs text-slate-500">(editado)</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>

      {showJumpToBottom && (
        <button
          type="button"
          onClick={jumpToBottom}
          className="absolute bottom-4 right-6 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg"
        >
          Ir al último mensaje
        </button>
      )}
    </div>
  );
}
