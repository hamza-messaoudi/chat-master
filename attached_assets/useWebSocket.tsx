'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export function useWebSocket(clientId: string) {
  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [socketReady, setSocketReady] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageQueueRef = useRef<string[]>([]);

  // Function to establish WebSocket connection
  const connectWebSocket = useCallback(() => {
    try {
      // Close any existing connection
      if (wsRef.current) {
        wsRef.current.close();
      }

      setConnectionStatus('connecting');
      const protocol = typeof window !== 'undefined' ? 
        (window.location.protocol === 'https:' ? 'wss:' : 'ws:') : 'wss:';
      
      // Use environment variable or fallback to current domain with port 5000
      const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 
        `${protocol}//${window.location.hostname}:5000`;
      
      const wsEndpoint = `${wsUrl}/ws?clientId=${clientId}`;
      console.log('Connecting to WebSocket:', wsEndpoint);
      
      const ws = new WebSocket(wsEndpoint);

      ws.onopen = () => {
        console.log('WebSocket connection established');
        setConnectionStatus('connected');
        setSocketReady(true);
        
        // Send any queued messages
        if (messageQueueRef.current.length > 0) {
          messageQueueRef.current.forEach(message => {
            ws.send(message);
          });
          messageQueueRef.current = [];
        }
      };

      ws.onmessage = (event) => {
        setLastMessage(event);
      };

      ws.onclose = (event) => {
        console.log('WebSocket connection closed', event.code, event.reason);
        setConnectionStatus('disconnected');
        setSocketReady(false);
        
        // Attempt to reconnect after a delay
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000); // Retry after 3 seconds
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('disconnected');
        setSocketReady(false);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to establish WebSocket connection:', error);
      setConnectionStatus('disconnected');
      setSocketReady(false);
    }
  }, [clientId]);

  // Connect on component mount
  useEffect(() => {
    connectWebSocket();

    // Cleanup function
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  // Handle browser online/offline events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      if (connectionStatus === 'disconnected') {
        connectWebSocket();
      }
    };

    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [connectionStatus, connectWebSocket]);

  // Function to send messages with fallback to queueing
  const sendSocketMessage = useCallback((message: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(message);
      return true;
    } else {
      // Queue message if socket isn't ready
      messageQueueRef.current.push(message);
      
      // Try to reconnect if we're disconnected
      if (connectionStatus === 'disconnected') {
        connectWebSocket();
      }
      
      return false;
    }
  }, [connectionStatus, connectWebSocket]);

  return {
    socketReady,
    sendSocketMessage,
    lastMessage,
    connectionStatus
  };
}

export default useWebSocket; 