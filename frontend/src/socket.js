class SocketClient {
  constructor() {
    this.ws = null;
    this.listeners = new Set();
    this.token = null;
  }

  connect(token) {
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) {
      return;
    }

    this.token = token;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = import.meta.env.VITE_WS_HOST || window.location.host;
    const url = `${protocol}//${host}/ws?token=${encodeURIComponent(token)}`;

    this.ws = new WebSocket(url);

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.listeners.forEach((listener) => listener(data));
      } catch {
        // ignore malformed payloads
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (this.token) {
        setTimeout(() => this.connect(this.token), 2000);
      }
    };
  }

  disconnect() {
    this.token = null;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  send(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  sendTyping(channelId) {
    this.send({ type: "typing", channel_id: channelId });
  }
}

const socket = new SocketClient();
export default socket;
