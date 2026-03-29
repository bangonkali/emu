import type { ClientMessage, ServerMessage } from '../types/protocol';

type MessageHandler = (msg: ServerMessage) => void;
type ConnectionHandler = () => void;

class RuntimeSocket {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private messageHandlers: MessageHandler[] = [];
  private connectHandlers: ConnectionHandler[] = [];
  private disconnectHandlers: ConnectionHandler[] = [];

  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  onConnect(handler: ConnectionHandler): void {
    this.connectHandlers.push(handler);
  }

  onDisconnect(handler: ConnectionHandler): void {
    this.disconnectHandlers.push(handler);
  }

  connect(): void {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${protocol}://${location.host}/ws`;
    this.ws = new WebSocket(url);

    this.ws.addEventListener('open', () => {
      this.connectHandlers.forEach((h) => h());
    });

    this.ws.addEventListener('close', () => {
      this.disconnectHandlers.forEach((h) => h());
      if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.connect(), 2000);
    });

    this.ws.addEventListener('message', (event: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        this.messageHandlers.forEach((h) => h(msg));
      } catch {
        // ignore malformed messages
      }
    });
  }

  send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}

export const runtimeSocket = new RuntimeSocket();
