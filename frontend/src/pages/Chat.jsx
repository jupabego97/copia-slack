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
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
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
  const loadingMoreRef = useRef(false);
  const messagesRef = useRef([]);
  const hasMoreRef = useRef(false);

  messagesRef.current = messages;
  hasMoreRef.current = hasMoreMessages;

  const activeChannel = useMemo(
    () => channels.find((ch) => ch.id === activeChannelId) || null,
    [channels, activeChannelId]
  );

  const regularChannels = useMemo(
    () => channels.filter((ch) => !ch.is_direct_message),
    [channels]
  );

  const directMessages = useMemo(
    () => channels.filter((ch) => ch.is_direct_message),
    [channels]
  );

  const loadNotificationCount = useCallback(async () => {
    try {
      const res = await api.get("/api/notifications/unread-count");
      setNotificationCount(res.data.count || 0);
    } catch {
      setNotificationCount(0);
    }
  }, []);

  const loadChannels = useCallback(async () => {
    try {
      setLoadError("");
      const res = await api.get("/api/channels");
      setChannels(res.data);
      if (!hasLoadedChannels.current && res.data.length > 0) {
        hasLoadedChannels.current = true;
        const general = res.data.find((ch) => ch.slug === "general");
        const initialId = (general || res.data[0]).id;
        activeChannelIdRef.current = initialId;
        setActiveChannelId(initialId);
      } else if (activeChannelIdRef.current) {
        setActiveChannelId(activeChannelIdRef.current);
      }
    } catch (err) {
      setLoadError(getErrorMessage(err, "No se pudieron cargar los canales."));
    }
  }, []);

  const markChannelRead = useCallback(async (channelId) => {
    if (!channelId) return;
    try {
      await api.post(`/api/channels/${channelId}/read`);
      setChannels((prev) =>
        prev.map((ch) => (ch.id === channelId ? { ...ch, unread_count: 0 } : ch))
      );
    } catch {/* silent */}
  }, []);

  const loadMessages = useCallback(async (channelId) => {
    if (!channelId) return;
    setLoadingMessages(true);
    setSendError("");
    setHasMoreMessages(false);
    try {
      const res = await api.get(`/api/channels/${channelId}/messages`, { params: { limit: 50 } });
      setMessages(res.data);
      setHasMoreMessages(res.data.length >= 50);
      await markChannelRead(channelId);
    } catch (err) {
      setMessages([]);
      setHasMoreMessages(false);
      setLoadError(getErrorMessage(err, "No se pudieron cargar los mensajes."));
    } finally {
      setLoadingMessages(false);
    }
  }, [markChannelRead]);

  const loadMoreMessages = useCallback(async () => {
    const channelId = activeChannelIdRef.current;
    if (!channelId || loadingMoreRef.current || !hasMoreRef.current) return;
    const oldestId = messagesRef.current[0]?.id;
    if (!oldestId) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const res = await api.get(`/api/channels/${channelId}/messages`, {
        params: { limit: 50, before_id: oldestId },
      });
      setMessages((prev) => {
        const existing = new Set(prev.map((m) => m.id));
        const older = res.data.filter((m) => !existing.has(m.id));
        return [...older, ...prev];
      });
      setHasMoreMessages(res.data.length >= 50);
    } catch {
      /* keep current messages */
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { loadChannels(); loadNotificationCount(); }, [loadChannels, loadNotificationCount]);

  useEffect(() => {
    activeChannelIdRef.current = activeChannelId;
    if (activeChannelId) loadMessages(activeChannelId);
  }, [activeChannelId, loadMessages]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const unsub = socket.subscribe((event) => {
      const cur = activeChannelIdRef.current;
      if (event.type === "new_message") {
        const cid = Number(event.channel_id);
        setChannels((prev) =>
          prev.map((ch) => {
            if (ch.id !== cid) return ch;
            return { ...ch, last_message: event.message, unread_count: cid === Number(cur) ? 0 : (ch.unread_count || 0) + 1 };
          })
        );
        if (cid === Number(cur)) {
          setMessages((prev) => prev.some((m) => m.id === event.message.id) ? prev : [...prev, event.message]);
          markChannelRead(cid);
        }
        return;
      }
      if (event.type === "message_updated") {
        const cid = Number(event.channel_id);
        if (cid === Number(cur)) setMessages((prev) => prev.map((m) => m.id === event.message.id ? event.message : m));
        setChannels((prev) => prev.map((ch) => ch.id === cid ? { ...ch, last_message: event.message } : ch));
        return;
      }
      if (event.type === "message_deleted") {
        const cid = Number(event.channel_id);
        if (cid === Number(cur)) setMessages((prev) => prev.filter((m) => m.id !== event.message_id));
        return;
      }
      if (event.type === "notification") { setNotificationCount((prev) => prev + 1); return; }
      if (event.type === "user_online" || event.type === "user_offline") {
        setChannels((prev) =>
          prev.map((ch) => ({ ...ch, members: ch.members.map((m) => m.id === event.user_id ? { ...m, is_online: event.type === "user_online" } : m) }))
        );
        return;
      }
      if (event.type === "typing") {
        const cid = Number(event.channel_id);
        const key = `${cid}-${event.user_id}`;
        setTypingByChannel((prev) => ({ ...prev, [cid]: { ...(prev[cid] || {}), [event.user_id]: event.display_name } }));
        if (typingTimers.current[key]) clearTimeout(typingTimers.current[key]);
        typingTimers.current[key] = setTimeout(() => {
          setTypingByChannel((prev) => { const c = { ...(prev[cid] || {}) }; delete c[event.user_id]; return { ...prev, [cid]: c }; });
          delete typingTimers.current[key];
        }, 2500);
      }
    });
    return unsub;
  }, [markChannelRead]);

  const handleSelectChannel = (channelId) => {
    setSendError(""); setLoadError("");
    activeChannelIdRef.current = channelId;
    setActiveChannelId(channelId);
  };

  const handleOpenDmChannel = (channel) => {
    setChannels((prev) => {
      const exists = prev.some((ch) => ch.id === channel.id);
      return exists ? prev.map((ch) => ch.id === channel.id ? channel : ch) : [...prev, channel];
    });
    handleSelectChannel(channel.id);
  };

  const handleSend = async (content) => {
    setSendError("");
    try {
      const res = await api.post(`/api/channels/${activeChannelId}/messages`, { content });
      setMessages((prev) => prev.some((m) => m.id === res.data.id) ? prev : [...prev, res.data]);
      setChannels((prev) => prev.map((ch) => ch.id === activeChannelId ? { ...ch, last_message: res.data, unread_count: 0 } : ch));
    } catch (err) {
      setSendError(getErrorMessage(err, "No se pudo enviar el mensaje."));
      throw err;
    }
  };

  const readOnly = activeChannel?.slug === "avisos" && user.role !== "gerencia";
  const typingUsers = Object.values(typingByChannel[Number(activeChannelId)] || {});
  const channelTitle = getChannelTitle(activeChannel, user.id);
  const memberCount = activeChannel?.members?.length ?? 0;

  return (
    <div className="flex h-full overflow-hidden" style={{ background: "#1A1D21" }}>
      <Sidebar
        user={user}
        channels={regularChannels}
        directMessages={directMessages}
        activeChannelId={activeChannelId}
        onSelectChannel={handleSelectChannel}
        onNewMessage={() => setNewMessageOpen(true)}
        onLogout={onLogout}
      />

      <main className="relative flex min-w-0 flex-1 flex-col" style={{ background: "#222529" }}>
        {/* ── Channel header ── */}
        <header className="flex h-[49px] shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.1)] bg-[#222529] px-4">
          <div className="flex min-w-0 items-center gap-2">
            {activeChannel && (
              <>
                <span className="text-[18px] font-black text-white leading-none">
                  {activeChannel.is_direct_message ? "" : "#"}
                </span>
                <h2 className="truncate text-[15px] font-extrabold text-white">
                  {channelTitle}
                </h2>
                {memberCount > 0 && !activeChannel.is_direct_message && (
                  <>
                    <span className="mx-1 h-4 w-px bg-[rgba(255,255,255,0.15)]" />
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs text-[#9B9EA4] hover:text-white transition"
                    >
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                      </svg>
                      {memberCount}
                    </button>
                  </>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Search */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-7 items-center gap-1.5 rounded-md border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)] px-2.5 text-[13px] text-[#9B9EA4] hover:bg-[rgba(255,255,255,0.1)] hover:text-white transition"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>Buscar</span>
              <kbd className="ml-1 rounded bg-[rgba(255,255,255,0.08)] px-1 py-px text-[11px] font-mono">⌃K</kbd>
            </button>

            {/* Notifications bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => { setNotificationsOpen((v) => !v); if (!notificationsOpen) loadNotificationCount(); }}
                className="relative flex h-8 w-8 items-center justify-center rounded-md text-[#9B9EA4] hover:bg-[rgba(255,255,255,0.08)] hover:text-white transition"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {notificationCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#E01E5A] px-1 text-[10px] font-black text-white leading-none">
                    {notificationCount > 99 ? "99+" : notificationCount}
                  </span>
                )}
              </button>
              <NotificationPanel
                open={notificationsOpen}
                onClose={() => { setNotificationsOpen(false); loadNotificationCount(); }}
                onOpenChannel={handleSelectChannel}
              />
            </div>
          </div>
        </header>

        {/* ── Error banner ── */}
        {loadError && (
          <div className="flex items-center justify-between border-b border-red-500/20 bg-red-500/10 px-5 py-2 text-sm text-red-300">
            <span>{loadError}</span>
            <button
              type="button"
              onClick={loadChannels}
              className="shrink-0 rounded bg-red-500/20 px-2.5 py-1 text-xs font-semibold hover:bg-red-500/30"
            >
              Reintentar
            </button>
          </div>
        )}

        {loadingMessages ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgba(255,255,255,0.1)] border-t-[#9B9EA4]" />
              <span className="text-sm text-[#9B9EA4]">Cargando mensajes…</span>
            </div>
          </div>
        ) : (
          <MessageList
            messages={messages}
            currentUserId={user.id}
            currentUserRole={user.role}
            currentUsername={user.username}
            hasMore={hasMoreMessages}
            loadingMore={loadingMore}
            onLoadMore={loadMoreMessages}
          />
        )}

        <MessageInput
          channelId={activeChannelId}
          channelName={activeChannel?.is_direct_message ? null : activeChannel?.name}
          dmTarget={activeChannel?.is_direct_message ? getChannelTitle(activeChannel, user.id) : null}
          members={activeChannel?.members || []}
          currentUserId={user.id}
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
            const res = await api.post(`/api/users/${userId}/dm`);
            handleOpenDmChannel(res.data);
          } catch (err) {
            setLoadError(getErrorMessage(err, "No se pudo abrir el DM."));
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
