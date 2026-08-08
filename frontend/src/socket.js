class SocketClient {
  constructor() {
    this.ws = null;
    this.listeners = new Set();
    this.statusListeners = new Set();
    this.token = null;
    this.reconnectTimer = null;
    this.status = "offline";
  }

  setStatus(status) {
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  connect(token) {
    if (!token) return;

    if (this.ws) {
      const state = this.ws.readyState;
      if (state === WebSocket.CONNECTING || state === WebSocket.OPEN) {
        return;
      }
    }

    this.token = token;
    this.setStatus("connecting");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = import.meta.env.VITE_WS_HOST || window.location.host;
    const url = `${protocol}//${host}/ws?token=${encodeURIComponent(token)}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.setStatus("online");
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.listeners.forEach((listener) => listener(data));
      } catch {
        // ignore malformed payloads
      }
    };

    this.ws.onclose = (event) => {
      this.ws = null;

      if (event.code === 1008) {
        this.token = null;
        this.setStatus("offline");
        return;
      }

      if (this.token) {
        this.setStatus("reconnecting");
        this.reconnectTimer = setTimeout(() => this.connect(this.token), 2000);
      } else {
        this.setStatus("offline");
      }
    };
  }

  disconnect() {
    this.token = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus("offline");
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeStatus(listener) {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  send(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  sendTyping(channelId) {
    if (!channelId) return;
    this.send({ type: "typing", channel_id: Number(channelId) });
  }
}

const socket = new SocketClient();
export default socket;
