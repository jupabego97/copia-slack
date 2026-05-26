import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api, { getErrorMessage } from "../api.js";
import socket from "../socket.js";
import MessageInput from "../components/MessageInput.jsx";
import MessageList from "../components/MessageList.jsx";
import Sidebar from "../components/Sidebar.jsx";

function getChannelTitle(channel, currentUserId) {
  if (!channel) return "Canal";
  if (!channel.is_direct_message) return channel.name;
  const other = channel.members?.find((member) => member.id !== currentUserId);
  return other?.display_name || channel.name;
}

export default function Chat({ user, onLogout }) {
  const [channels, setChannels] = useState([]);
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [sendError, setSendError] = useState("");
  const [typingByChannel, setTypingByChannel] = useState({});
  const typingTimers = useRef({});
  const activeChannelIdRef = useRef(null);
  const hasLoadedChannels = useRef(false);

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
    try {
      setLoadError("");
      const response = await api.get("/api/channels");
      setChannels(response.data);

      if (!hasLoadedChannels.current && response.data.length > 0) {
        hasLoadedChannels.current = true;
        const general = response.data.find((channel) => channel.slug === "general");
        const initialId = (general || response.data[0]).id;
        activeChannelIdRef.current = initialId;
        setActiveChannelId(initialId);
      }
    } catch (error) {
      setLoadError(
        getErrorMessage(error, "No se pudieron cargar los canales. Revisa tu conexión.")
      );
    }
  }, []);

  const loadMessages = useCallback(async (channelId) => {
    if (!channelId) return;

    setLoadingMessages(true);
    setSendError("");
    try {
      const response = await api.get(`/api/channels/${channelId}/messages`, {
        params: { limit: 50 },
      });
      setMessages(response.data);
    } catch (error) {
      setMessages([]);
      setLoadError(
        getErrorMessage(error, "No se pudieron cargar los mensajes de este canal.")
      );
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  useEffect(() => {
    activeChannelIdRef.current = activeChannelId;
    if (activeChannelId) {
      loadMessages(activeChannelId);
    }
  }, [activeChannelId, loadMessages]);

  useEffect(() => {
    const unsubscribe = socket.subscribe((event) => {
      const currentChannelId = activeChannelIdRef.current;

      if (event.type === "new_message") {
        const channelId = Number(event.channel_id);
        if (channelId === Number(currentChannelId)) {
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

      if (event.type === "typing") {
        const channelId = Number(event.channel_id);
        const key = `${channelId}-${event.user_id}`;

        setTypingByChannel((prev) => ({
          ...prev,
          [channelId]: {
            ...(prev[channelId] || {}),
            [event.user_id]: event.display_name,
          },
        }));

        if (typingTimers.current[key]) {
          clearTimeout(typingTimers.current[key]);
        }

        typingTimers.current[key] = setTimeout(() => {
          setTypingByChannel((prev) => {
            const channelTyping = { ...(prev[channelId] || {}) };
            delete channelTyping[event.user_id];
            return { ...prev, [channelId]: channelTyping };
          });
          delete typingTimers.current[key];
        }, 2500);
      }
    });

    return unsubscribe;
  }, []);

  const handleSelectChannel = (channelId) => {
    setSendError("");
    setLoadError("");
    activeChannelIdRef.current = channelId;
    setActiveChannelId(channelId);
  };

  const handleSend = async (content) => {
    setSendError("");
    try {
      const response = await api.post(`/api/channels/${activeChannelId}/messages`, {
        content,
      });
      setMessages((prev) => {
        if (prev.some((message) => message.id === response.data.id)) {
          return prev;
        }
        return [...prev, response.data];
      });
    } catch (error) {
      setSendError(getErrorMessage(error, "No se pudo enviar el mensaje."));
      throw error;
    }
  };

  const readOnly = activeChannel?.slug === "avisos" && user.role !== "gerencia";
  const typingUsers = Object.values(typingByChannel[Number(activeChannelId)] || {});

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar
        user={user}
        channels={regularChannels}
        directMessages={directMessages}
        activeChannelId={activeChannelId}
        onSelectChannel={handleSelectChannel}
        onLogout={onLogout}
      />

      <main className="flex min-w-0 flex-1 flex-col bg-main">
        <header className="flex h-12 shrink-0 items-center border-b border-white/10 px-5 shadow-sm">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-bold text-slate-100">
              {activeChannel?.is_direct_message ? "" : "#"}
              {getChannelTitle(activeChannel, user.id)}
            </h2>
          </div>
        </header>

        {loadError && (
          <div className="flex items-center justify-between gap-3 border-b border-red-500/20 bg-red-500/10 px-5 py-2 text-sm text-red-300">
            <span>{loadError}</span>
            <button
              type="button"
              onClick={loadChannels}
              className="shrink-0 rounded-md bg-red-500/20 px-3 py-1 text-xs font-medium hover:bg-red-500/30"
            >
              Reintentar
            </button>
          </div>
        )}

        {loadingMessages ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
            Cargando mensajes...
          </div>
        ) : (
          <MessageList messages={messages} currentUserId={user.id} />
        )}

        <MessageInput
          channelId={activeChannelId}
          channelName={activeChannel?.is_direct_message ? null : activeChannel?.name}
          onSend={handleSend}
          readOnly={readOnly}
          typingUsers={typingUsers}
          error={sendError}
        />
      </main>
    </div>
  );
}
