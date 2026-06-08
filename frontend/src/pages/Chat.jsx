import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api, { getErrorMessage } from "../api.js";
import socket from "../socket.js";
import MessageInput from "../components/MessageInput.jsx";
import MessageList from "../components/MessageList.jsx";
import NewMessageModal from "../components/NewMessageModal.jsx";
import NotificationPanel from "../components/NotificationPanel.jsx";
import SearchModal from "../components/SearchModal.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { getChannelTitle } from "../utils/format.js";

export default function Chat({ user, onLogout }) {
  const [channels, setChannels] = useState([]);
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [sendError, setSendError] = useState("");
  const [typingByChannel, setTypingByChannel] = useState({});
  const [notificationCount, setNotificationCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

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

  const loadNotificationCount = useCallback(async () => {
    try {
      const response = await api.get("/api/notifications/unread-count");
      setNotificationCount(response.data.count || 0);
    } catch {
      setNotificationCount(0);
    }
  }, []);

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
      } else if (activeChannelIdRef.current) {
        setActiveChannelId(activeChannelIdRef.current);
      }
    } catch (error) {
      setLoadError(
        getErrorMessage(error, "No se pudieron cargar los canales. Revisa tu conexión.")
      );
    }
  }, []);

  const markChannelRead = useCallback(async (channelId) => {
    if (!channelId) return;
    try {
      await api.post(`/api/channels/${channelId}/read`);
      setChannels((prev) =>
        prev.map((channel) =>
          channel.id === channelId ? { ...channel, unread_count: 0 } : channel
        )
      );
    } catch {
      // ignore read errors silently
    }
  }, []);

  const loadMessages = useCallback(
    async (channelId) => {
      if (!channelId) return;

      setLoadingMessages(true);
      setSendError("");
      try {
        const response = await api.get(`/api/channels/${channelId}/messages`, {
          params: { limit: 50 },
        });
        setMessages(response.data);
        await markChannelRead(channelId);
      } catch (error) {
        setMessages([]);
        setLoadError(
          getErrorMessage(error, "No se pudieron cargar los mensajes de este canal.")
        );
      } finally {
        setLoadingMessages(false);
      }
    },
    [markChannelRead]
  );

  useEffect(() => {
    loadChannels();
    loadNotificationCount();
  }, [loadChannels, loadNotificationCount]);

  useEffect(() => {
    activeChannelIdRef.current = activeChannelId;
    if (activeChannelId) {
      loadMessages(activeChannelId);
    }
  }, [activeChannelId, loadMessages]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const unsubscribe = socket.subscribe((event) => {
      const currentChannelId = activeChannelIdRef.current;

      if (event.type === "new_message") {
        const channelId = Number(event.channel_id);
        setChannels((prev) =>
          prev.map((channel) => {
            if (channel.id !== channelId) return channel;
            return {
              ...channel,
              last_message: event.message,
              unread_count:
                channelId === Number(currentChannelId)
                  ? 0
                  : (channel.unread_count || 0) + 1,
            };
          })
        );

        if (channelId === Number(currentChannelId)) {
          setMessages((prev) => {
            if (prev.some((message) => message.id === event.message.id)) {
              return prev;
            }
            return [...prev, event.message];
          });
          markChannelRead(channelId);
        }
        return;
      }

      if (event.type === "message_updated") {
        const channelId = Number(event.channel_id);
        if (channelId === Number(currentChannelId)) {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === event.message.id ? event.message : message
            )
          );
        }
        setChannels((prev) =>
          prev.map((channel) =>
            channel.id === channelId ? { ...channel, last_message: event.message } : channel
          )
        );
        return;
      }

      if (event.type === "message_deleted") {
        const channelId = Number(event.channel_id);
        if (channelId === Number(currentChannelId)) {
          setMessages((prev) => prev.filter((message) => message.id !== event.message_id));
        }
        return;
      }

      if (event.type === "notification") {
        setNotificationCount((prev) => prev + 1);
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
  }, [markChannelRead]);

  const handleSelectChannel = (channelId) => {
    setSendError("");
    setLoadError("");
    activeChannelIdRef.current = channelId;
    setActiveChannelId(channelId);
  };

  const handleOpenDmChannel = (channel) => {
    setChannels((prev) => {
      const exists = prev.some((item) => item.id === channel.id);
      return exists ? prev.map((item) => (item.id === channel.id ? channel : item)) : [...prev, channel];
    });
    handleSelectChannel(channel.id);
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
      setChannels((prev) =>
        prev.map((channel) =>
          channel.id === activeChannelId
            ? { ...channel, last_message: response.data, unread_count: 0 }
            : channel
        )
      );
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
        onNewMessage={() => setNewMessageOpen(true)}
        onLogout={onLogout}
      />

      <main className="relative flex min-w-0 flex-1 flex-col bg-main">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-5 shadow-sm">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-bold text-slate-100">
              {activeChannel?.is_direct_message ? "" : "#"}
              {getChannelTitle(activeChannel, user.id)}
            </h2>
            {activeChannel?.description && !activeChannel?.is_direct_message && (
              <p className="truncate text-xs text-slate-500">{activeChannel.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
            >
              Buscar Ctrl+K
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen((value) => !value);
                  if (!notificationsOpen) loadNotificationCount();
                }}
                className="relative rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
              >
                Notificaciones
                {notificationCount > 0 && (
                  <span className="absolute -right-1 -top-1 rounded-full bg-accent px-1.5 text-[10px] font-bold text-slate-900">
                    {notificationCount > 99 ? "99+" : notificationCount}
                  </span>
                )}
              </button>
              <NotificationPanel
                open={notificationsOpen}
                onClose={() => {
                  setNotificationsOpen(false);
                  loadNotificationCount();
                }}
                onOpenChannel={handleSelectChannel}
              />
            </div>
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

      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectChannel={handleSelectChannel}
        onSelectUser={async (userId) => {
          try {
            const response = await api.post(`/api/users/${userId}/dm`);
            handleOpenDmChannel(response.data);
          } catch (error) {
            setLoadError(getErrorMessage(error, "No se pudo abrir el mensaje directo."));
          }
        }}
      />

      <NewMessageModal
        open={newMessageOpen}
        onClose={() => setNewMessageOpen(false)}
        onOpenDm={handleOpenDmChannel}
      />
    </div>
  );
}
