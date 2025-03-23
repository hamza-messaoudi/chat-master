import { WebSocketEvents } from "@/types/chat";

class WebSocketClient {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: number = 1000;
  private clientId: string;
  private events: WebSocketEvents = {
    onMessage: () => {},
    onTyping: () => {},
    onStatusChange: () => {},
    onReadReceipt: () => {},
    onConnectionChange: () => {},
  };

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  connect() {
    if (this.socket?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?clientId=${this.clientId}`;
    
    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      console.log("WebSocket connection established");
      this.reconnectAttempts = 0;
      this.events.onConnectionChange(true);
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'message':
            this.events.onMessage(data.payload);
            break;
          case 'typing':
            this.events.onTyping(data.payload);
            break;
          case 'status':
            this.events.onStatusChange(data.payload);
            break;
          case 'read':
            this.events.onReadReceipt(data.payload);
            break;
          default:
            console.warn('Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.socket.onclose = (event) => {
      this.events.onConnectionChange(false);
      
      if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const timeout = this.reconnectTimeout * Math.pow(2, this.reconnectAttempts - 1);
        console.log(`WebSocket connection closed. Reconnecting in ${timeout}ms...`);
        setTimeout(() => this.connect(), timeout);
      } else {
        console.log('WebSocket connection closed');
      }
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  send(type: string, payload: any) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, payload }));
      return true;
    }
    return false;
  }

  setEventHandlers(events: Partial<WebSocketEvents>) {
    this.events = { ...this.events, ...events };
  }
  
  getEventHandlers(): WebSocketEvents {
    return { ...this.events };
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }
}

export default WebSocketClient;
