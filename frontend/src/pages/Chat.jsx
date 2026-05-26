import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../api.js";
import socket from "../socket.js";
import MessageInput from "../components/MessageInput.jsx";
import MessageList from "../components/MessageList.jsx";
import Sidebar from "../components/Sidebar.jsx";

export default function Chat({ user, onLogout }) {
  const [channels, setChannels] = useState([]);
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typingByChannel, setTypingByChannel] = useState({});
  const typingTimers = useRef({});

  const activeChannel = useMemo(
    () => channels.find((channel) => channel.id === activeChannelId) || null,
    [channels, activeChannelId]
  );

  const regularChannels = useMemo(
    () => channels.filter((channel) => !channel.is_direct_message),
    [channels]
  );

  const directMessages = useMemo(
    () => channels.filter((channel) => channel.is_direct_message),
    [channels]
  );

  const loadChannels = useCallback(async () => {
    const response = await api.get("/api/channels");
    setChannels(response.data);
    if (!activeChannelId && response.data.length > 0) {
      const general = response.data.find((channel) => channel.slug === "general");
      setActiveChannelId((general || response.data[0]).id);
    }
  }, [activeChannelId]);

  const loadMessages = useCallback(async (channelId) => {
    setLoadingMessages(true);
    try {
      const response = await api.get(`/api/channels/${channelId}/messages`, {
        params: { limit: 50 },
      });
      setMessages(response.data);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  useEffect(() => {
    if (activeChannelId) {
      loadMessages(activeChannelId);
    }
  }, [activeChannelId, loadMessages]);

  useEffect(() => {
    const unsubscribe = socket.subscribe((event) => {
      if (event.type === "new_message") {
        if (event.channel_id === activeChannelId) {
          setMessages((prev) => {
            if (prev.some((message) => message.id === event.message.id)) {
              return prev;
            }
            return [...prev, event.message];
          });
        }
        return;
      }

      if (event.type === "user_online" || event.type === "user_offline") {
        setChannels((prev) =>
          prev.map((channel) => ({
            ...channel,
            members: channel.members.map((member) =>
              member.id === event.user_id
                ? { ...member, is_online: event.type === "user_online" }
                : member
            ),
          }))
        );
        return;
      }

      if (event.type === "typing" && event.channel_id) {
        const key = `${event.channel_id}-${event.user_id}`;
        setTypingByChannel((prev) => ({
          ...prev,
          [event.channel_id]: {
            ...(prev[event.channel_id] || {}),
            [event.user_id]: event.display_name,
          },
        }));

        if (typingTimers.current[key]) {
          clearTimeout(typingTimers.current[key]);
        }

        typingTimers.current[key] = setTimeout(() => {
          setTypingByChannel((prev) => {
            const channelTyping = { ...(prev[event.channel_id] || {}) };
            delete channelTyping[event.user_id];
            return { ...prev, [event.channel_id]: channelTyping };
          });
          delete typingTimers.current[key];
        }, 2500);
      }
    });

    return unsubscribe;
  }, [activeChannelId]);

  const handleSend = async (content) => {
    const response = await api.post(`/api/channels/${activeChannelId}/messages`, {
      content,
    });
    setMessages((prev) => {
      if (prev.some((message) => message.id === response.data.id)) {
        return prev;
      }
      return [...prev, response.data];
    });
  };

  const readOnly =
    activeChannel?.slug === "avisos" && user.role !== "gerencia";

  const typingUsers = Object.values(typingByChannel[activeChannelId] || {});

  return (
    <div className="flex h-full">
      <Sidebar
        user={user}
        channels={regularChannels}
        directMessages={directMessages}
        activeChannelId={activeChannelId}
        onSelectChannel={setActiveChannelId}
        onLogout={onLogout}
      />

      <main className="flex min-w-0 flex-1 flex-col bg-main">
        <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              {activeChannel?.is_direct_message ? "" : "#"}
              {activeChannel?.name || "Canal"}
            </h2>
            {activeChannel?.description && (
              <p className="text-sm text-slate-400">{activeChannel.description}</p>
            )}
          </div>
        </header>

        {loadingMessages ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
            Cargando mensajes...
          </div>
        ) : (
          <MessageList messages={messages} currentUserId={user.id} />
        )}

        <MessageInput
          channelId={activeChannelId}
          onSend={handleSend}
          readOnly={readOnly}
          typingUsers={typingUsers}
        />
      </main>
    </div>
  );
}
