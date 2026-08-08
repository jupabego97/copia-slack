import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api, { getErrorMessage } from "../api.js";
import socket from "../socket.js";
import ChannelBrowserModal from "../components/ChannelBrowserModal.jsx";
import MessageInput from "../components/MessageInput.jsx";
import MessageList from "../components/MessageList.jsx";
import NewMessageModal from "../components/NewMessageModal.jsx";
import NotificationPanel from "../components/NotificationPanel.jsx";
import SearchModal from "../components/SearchModal.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { getChannelTitle } from "../utils/format.js";

function ChannelMembersPopover({ channel, onClose }) {
  if (!channel) return null;
  return (
    <div className="absolute left-4 top-[calc(100%+6px)] z-30 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-white/10 bg-[#222529] shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <h3 className="text-sm font-extrabold text-white">Miembros</h3>
          <p className="text-xs text-[#9B9EA4]">{channel.members?.length || 0} personas en este canal</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar miembros" className="flex h-7 w-7 items-center justify-center rounded-md text-[#9B9EA4] hover:bg-white/10 hover:text-white">
          <span aria-hidden="true" className="text-lg leading-none">×</span>
        </button>
      </div>
      <div className="max-h-72 overflow-y-auto p-2">
        {(channel.members || []).map((member) => (
          <div key={member.id} className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-white/5">
            <span className={`h-2.5 w-2.5 rounded-full ${member.is_online ? "bg-[#2BAC76]" : "bg-[#6B6F76]"}`} />
            <span className="min-w-0 flex-1 truncate text-sm text-[#D1D2D3]">{member.display_name}</span>
            <span className="text-[11px] text-[#6B6F76]">{member.role}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConnectionBanner({ status }) {
  if (status === "online") return null;
  const copy = status === "connecting" ? "Conectando al chat…" : "Sin conexión. Reintentando automáticamente…";
  return (
    <div className="flex shrink-0 items-center justify-center gap-2 border-b border-[#ECB22E]/20 bg-[#ECB22E]/10 px-4 py-2 text-xs font-semibold text-[#F7C948]" role="status">
      <span className="h-2 w-2 animate-pulse rounded-full bg-[#ECB22E]" />
      {copy}
    </div>
  );
}

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
  const [channelBrowserOpen, setChannelBrowserOpen] = useState(false);
  const [channelInfoOpen, setChannelInfoOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [unreadBoundaryId, setUnreadBoundaryId] = useState(null);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState("offline");
  const [replyingTo, setReplyingTo] = useState(null);

  const typingTimers = useRef({});
  const activeChannelIdRef = useRef(null);
  const hasLoadedChannels = useRef(false);
  const loadingMoreRef = useRef(false);
  const messagesRef = useRef([]);
  const hasMoreRef = useRef(false);
  const channelsRef = useRef([]);

  messagesRef.current = messages;
  hasMoreRef.current = hasMoreMessages;
  channelsRef.current = channels;

  const activeChannel = useMemo(
    () => channels.find((channel) => channel.id === activeChannelId) || null,
    [channels, activeChannelId]
  );
  const regularChannels = useMemo(() => channels.filter((channel) => !channel.is_direct_message), [channels]);
  const directMessages = useMemo(() => channels.filter((channel) => channel.is_direct_message), [channels]);

  const loadNotificationCount = useCallback(async () => {
    try {
      const res = await api.get("/api/notifications/unread-count");
      setNotificationCount(res.data.count || 0);
    } catch {
      setNotificationCount(0);
    }
  }, []);

  const markChannelRead = useCallback(async (channelId, lastMessageId = null) => {
    if (!channelId) return;
    try {
      await api.post(`/api/channels/${channelId}/read`);
      setChannels((prev) => prev.map((channel) => (
        channel.id === channelId
          ? { ...channel, unread_count: 0, last_read_message_id: lastMessageId ?? messagesRef.current.at(-1)?.id ?? channel.last_read_message_id }
          : channel
      )));
      setNewMessageCount(0);
    } catch {
      // The next channel refresh will reconcile the read state.
    }
  }, []);

  const loadChannels = useCallback(async () => {
    try {
      setLoadError("");
      const res = await api.get("/api/channels");
      setChannels(res.data);
      if (!hasLoadedChannels.current && res.data.length > 0) {
        hasLoadedChannels.current = true;
        const general = res.data.find((channel) => channel.slug === "general");
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

  const loadMessages = useCallback(async (channelId) => {
    if (!channelId) return;
    setLoadingMessages(true);
    setSendError("");
    setHasMoreMessages(false);
    const channelBeforeRead = channelsRef.current.find((channel) => channel.id === channelId);
    setUnreadBoundaryId(channelBeforeRead?.unread_count ? channelBeforeRead.last_read_message_id ?? null : null);
    try {
      const res = await api.get(`/api/channels/${channelId}/messages`, { params: { limit: 50 } });
      setMessages(res.data);
      setHasMoreMessages(res.data.length >= 50);
      await markChannelRead(channelId, res.data.at(-1)?.id ?? null);
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
        const existing = new Set(prev.map((message) => message.id));
        const older = res.data.filter((message) => !existing.has(message.id));
        return [...older, ...prev];
      });
      setHasMoreMessages(res.data.length >= 50);
    } catch {
      // Keep the currently visible messages if history cannot be extended.
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadChannels();
    loadNotificationCount();
  }, [loadChannels, loadNotificationCount]);

  useEffect(() => {
    activeChannelIdRef.current = activeChannelId;
    setNewMessageCount(0);
    if (activeChannelId) loadMessages(activeChannelId);
  }, [activeChannelId, loadMessages]);

  useEffect(() => {
    const unsubscribe = socket.subscribeStatus(setConnectionStatus);
    return unsubscribe;
  }, []);

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
      const currentId = activeChannelIdRef.current;
      if (event.type === "new_message") {
        const channelId = Number(event.channel_id);
        setChannels((prev) => prev.map((channel) => {
          if (channel.id !== channelId) return channel;
          return {
            ...channel,
            last_message: event.message,
            unread_count: channelId === Number(currentId) ? channel.unread_count || 0 : (channel.unread_count || 0) + 1,
          };
        }));
        if (channelId === Number(currentId)) {
          if (!messagesRef.current.some((message) => message.id === event.message.id)) {
            messagesRef.current = [...messagesRef.current, event.message];
            setMessages(messagesRef.current);
            setNewMessageCount((count) => count + 1);
          }
        }
        return;
      }
      if (event.type === "message_updated") {
        const channelId = Number(event.channel_id);
        if (channelId === Number(currentId)) setMessages((prev) => prev.map((message) => message.id === event.message.id ? event.message : message));
        setChannels((prev) => prev.map((channel) => channel.id === channelId ? { ...channel, last_message: event.message } : channel));
        return;
      }
      if (event.type === "message_deleted") {
        const channelId = Number(event.channel_id);
        if (channelId === Number(currentId)) setMessages((prev) => prev.filter((message) => message.id !== event.message_id));
        return;
      }
      if (event.type === "notification") {
        setNotificationCount((count) => count + 1);
        return;
      }
      if (event.type === "user_online" || event.type === "user_offline") {
        setChannels((prev) => prev.map((channel) => ({
          ...channel,
          members: channel.members.map((member) => member.id === event.user_id
            ? { ...member, is_online: event.type === "user_online" }
            : member),
        })));
        return;
      }
      if (event.type === "typing") {
        const channelId = Number(event.channel_id);
        const key = `${channelId}-${event.user_id}`;
        setTypingByChannel((prev) => ({ ...prev, [channelId]: { ...(prev[channelId] || {}), [event.user_id]: event.display_name } }));
        if (typingTimers.current[key]) clearTimeout(typingTimers.current[key]);
        typingTimers.current[key] = setTimeout(() => {
          setTypingByChannel((prev) => {
            const current = { ...(prev[channelId] || {}) };
            delete current[event.user_id];
            return { ...prev, [channelId]: current };
          });
          delete typingTimers.current[key];
        }, 2500);
      }
    });
    return unsubscribe;
  }, []);

  const handleSelectChannel = (channelId, messageId = null) => {
    setSendError("");
    setLoadError("");
    setChannelInfoOpen(false);
    setHighlightedMessageId(messageId);
    setReplyingTo(null);
    activeChannelIdRef.current = channelId;
    setActiveChannelId(channelId);
    setMobileSidebarOpen(false);
  };

  const handleOpenDmChannel = (channel) => {
    setChannels((prev) => {
      const exists = prev.some((item) => item.id === channel.id);
      return exists ? prev.map((item) => item.id === channel.id ? channel : item) : [...prev, channel];
    });
    handleSelectChannel(channel.id);
  };

  const handleChannelReady = (channel) => {
    setChannels((prev) => {
      const exists = prev.some((item) => item.id === channel.id);
      return exists ? prev.map((item) => item.id === channel.id ? channel : item) : [...prev, channel];
    });
    handleSelectChannel(channel.id);
  };

  const handleSend = async (content, reply) => {
    setSendError("");
    try {
      const quotedContent = reply
        ? `> ${reply.sender.display_name}: ${reply.content.slice(0, 240)}\n\n${content.slice(0, 3700)}`
        : content;
      const res = await api.post(`/api/channels/${activeChannelId}/messages`, { content: quotedContent });
      setMessages((prev) => prev.some((message) => message.id === res.data.id) ? prev : [...prev, res.data]);
      setChannels((prev) => prev.map((channel) => channel.id === activeChannelId
        ? { ...channel, last_message: res.data, unread_count: 0 }
        : channel));
      setNewMessageCount(0);
      setReplyingTo(null);
    } catch (err) {
      setSendError(getErrorMessage(err, "No se pudo enviar el mensaje."));
      throw err;
    }
  };

  const handleToggleReaction = async (messageId, emoji) => {
    try {
      const res = await api.post(`/api/messages/${messageId}/reactions`, { emoji });
      setMessages((prev) => prev.map((message) => message.id === messageId ? res.data : message));
    } catch (err) {
      setSendError(getErrorMessage(err, "No se pudo actualizar la reacción."));
    }
  };

  const handleOpenNotification = (notification) => {
    handleSelectChannel(notification.channel_id, notification.message_id);
  };

  const handleReachBottom = useCallback(() => {
    const channel = channelsRef.current.find((item) => item.id === activeChannelId);
    if ((channel?.unread_count || 0) > 0 || newMessageCount > 0) markChannelRead(activeChannelId);
  }, [activeChannelId, markChannelRead, newMessageCount]);

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
        onExploreChannels={() => setChannelBrowserOpen(true)}
        onLogout={onLogout}
        open={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        connectionStatus={connectionStatus}
      />

      {mobileSidebarOpen && (
        <button type="button" aria-label="Cerrar navegación" onClick={() => setMobileSidebarOpen(false)} className="fixed inset-0 z-30 bg-black/60 lg:hidden" />
      )}

      <main className="relative flex min-w-0 flex-1 flex-col bg-[#222529]">
        <header className="relative flex min-h-[58px] shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#222529] px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" onClick={() => setMobileSidebarOpen(true)} aria-label="Abrir navegación" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[#9B9EA4] hover:bg-white/10 hover:text-white lg:hidden">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            {activeChannel && (
              <>
                <span className="text-[18px] font-black leading-none text-white">{activeChannel.is_direct_message ? "" : "#"}</span>
                <div className="min-w-0">
                  <h2 className="truncate text-[15px] font-extrabold text-white">{channelTitle}</h2>
                  {!activeChannel.is_direct_message && activeChannel.description && (
                    <p className="hidden max-w-[42vw] truncate text-xs text-[#9B9EA4] sm:block">{activeChannel.description}</p>
                  )}
                </div>
                {memberCount > 0 && !activeChannel.is_direct_message && (
                  <>
                    <span className="mx-1 hidden h-4 w-px bg-white/15 sm:block" />
                    <button
                      type="button"
                      onClick={() => setChannelInfoOpen((value) => !value)}
                      aria-expanded={channelInfoOpen}
                      aria-label={`Ver ${memberCount} miembros`}
                      className="flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-xs text-[#9B9EA4] hover:bg-white/10 hover:text-white"
                    >
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg>
                      <span>{memberCount}</span>
                    </button>
                  </>
                )}
              </>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => setSearchOpen(true)} aria-label="Buscar" className="flex h-8 items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.06] px-2.5 text-[13px] text-[#9B9EA4] hover:bg-white/10 hover:text-white sm:h-7">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <span className="hidden sm:inline">Buscar</span>
              <kbd className="hidden rounded bg-white/[0.08] px-1 py-px text-[11px] font-mono sm:inline">⌘K</kbd>
            </button>

            <div className="relative">
              <button type="button" onClick={() => { setNotificationsOpen((value) => !value); if (!notificationsOpen) loadNotificationCount(); }} aria-label="Notificaciones" aria-expanded={notificationsOpen} className="relative flex h-8 w-8 items-center justify-center rounded-md text-[#9B9EA4] hover:bg-white/[0.08] hover:text-white">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                {notificationCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#E01E5A] px-1 text-[10px] font-black leading-none text-white">{notificationCount > 99 ? "99+" : notificationCount}</span>}
              </button>
              <NotificationPanel open={notificationsOpen} onClose={() => { setNotificationsOpen(false); loadNotificationCount(); }} onOpenChannel={handleSelectChannel} onOpenMessage={handleOpenNotification} />
            </div>
          </div>

          {channelInfoOpen && <ChannelMembersPopover channel={activeChannel} onClose={() => setChannelInfoOpen(false)} />}
        </header>

        <ConnectionBanner status={connectionStatus} />

        {loadError && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-300" role="alert">
            <span className="min-w-0">{loadError}</span>
            <button type="button" onClick={loadChannels} className="shrink-0 rounded bg-red-500/20 px-2.5 py-1 text-xs font-semibold hover:bg-red-500/30">Reintentar</button>
          </div>
        )}

        {loadingMessages ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-3" role="status">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#9B9EA4]" />
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
            highlightedMessageId={highlightedMessageId}
            unreadBoundaryId={unreadBoundaryId}
            newMessageCount={newMessageCount}
            onReachBottom={handleReachBottom}
            onReply={setReplyingTo}
            onToggleReaction={handleToggleReaction}
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
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
        />
      </main>

      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectChannel={handleSelectChannel}
        onSelectMessage={(message) => handleSelectChannel(message.channel_id, message.id)}
        onSelectUser={async (userId) => {
          try {
            const res = await api.post(`/api/users/${userId}/dm`);
            handleOpenDmChannel(res.data);
          } catch (err) {
            setLoadError(getErrorMessage(err, "No se pudo abrir el DM."));
          }
        }}
      />

      <NewMessageModal open={newMessageOpen} onClose={() => setNewMessageOpen(false)} onOpenDm={handleOpenDmChannel} currentUserId={user.id} />
      <ChannelBrowserModal open={channelBrowserOpen} onClose={() => setChannelBrowserOpen(false)} onChannelReady={handleChannelReady} />
    </div>
  );
}
