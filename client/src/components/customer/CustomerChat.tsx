import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import WebSocketClient from "@/lib/websocket";
import { Message } from "@shared/schema";

interface CustomerChatProps {
  customerId: string;
  conversationId: number;
}

export default function CustomerChat({ customerId, conversationId }: CustomerChatProps) {
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [agentIsTyping, setAgentIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [webSocketClient, setWebSocketClient] = useState<WebSocketClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch messages
  const { data: messages, isLoading: isLoadingMessages } = useQuery<Message[]>({
    queryKey: [`/api/conversations/${conversationId}/messages`],
  });
  
  // Set up WebSocket connection
  useEffect(() => {
    const client = new WebSocketClient(customerId);
    
    client.setEventHandlers({
      onMessage: (message) => {
        // Refetch messages when a new message is received
        queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}/messages`] });
        
        // If it's from an agent, play a notification sound
        if (message.isFromAgent) {
          // In a real app, we would play a sound here
        }
      },
      onTyping: (typingIndicator) => {
        if (typingIndicator.conversationId === conversationId) {
          setAgentIsTyping(typingIndicator.isTyping);
        }
      },
      onConnectionChange: (isConnected) => {
        setIsConnected(isConnected);
      }
    });
    
    client.connect();
    setWebSocketClient(client);
    
    return () => {
      client.disconnect();
    };
  }, [customerId, conversationId]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, agentIsTyping]);
  
  // Handle sending a message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !webSocketClient) return;
    
    try {
      // Send via WebSocket
      webSocketClient.send('message', {
        conversationId,
        content: newMessage,
        senderId: customerId,
        isFromAgent: false
      });
      
      // Clear input
      setNewMessage("");
      
      // Clear typing indicator
      if (typingTimeout) {
        clearTimeout(typingTimeout);
        setTypingTimeout(null);
      }
      setIsTyping(false);
      webSocketClient.send('typing', {
        conversationId,
        isTyping: false,
        isAgent: false
      });
      
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Handle typing indicator
  const handleTyping = () => {
    if (!isTyping && webSocketClient) {
      setIsTyping(true);
      webSocketClient.send('typing', {
        conversationId,
        isTyping: true,
        isAgent: false
      });
    }
    
    // Clear previous timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    
    // Set new timeout to clear typing indicator
    const timeout = setTimeout(() => {
      setIsTyping(false);
      if (webSocketClient) {
        webSocketClient.send('typing', {
          conversationId,
          isTyping: false,
          isAgent: false
        });
      }
    }, 3000);
    
    setTypingTimeout(timeout);
  };
  
  // Handle message input change
  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    handleTyping();
  };
  
  // Handle message input key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  // Handle ending the chat
  const handleEndChat = async () => {
    try {
      await fetch(`/api/conversations/${conversationId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' }),
      });
      
      toast({
        title: "Chat Ended",
        description: "Thank you for using our support chat service.",
      });
      
      // In a real app, we might redirect the user to a feedback form
      setTimeout(() => {
        window.location.href = "/";
      }, 3000);
    } catch (error) {
      console.error("Error ending chat:", error);
      toast({
        title: "Error",
        description: "Failed to end chat. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Format timestamp for display
  const formatTime = (timestamp: Date | null) => {
    if (!timestamp) return "--:--";
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  return (
    <div className="flex flex-col h-screen bg-neutral-light">
      {/* Chat header */}
      <div className="p-4 bg-primary text-white shadow-md flex items-center">
        <span className="material-icons mr-2">support_agent</span>
        <h1 className="text-xl">Support Chat</h1>
        <div className="ml-auto">
          {isConnected ? (
            <span className="text-xs bg-success text-white px-2 py-1 rounded-full">Connected</span>
          ) : (
            <span className="text-xs bg-error text-white px-2 py-1 rounded-full">Reconnecting...</span>
          )}
        </div>
      </div>
      
      {/* Chat messages */}
      <div className="flex-grow p-4 overflow-y-auto custom-scrollbar">
        {isLoadingMessages ? (
          <div className="flex flex-col space-y-4">
            <div className="text-center text-sm bg-white p-3 rounded-lg shadow-sm mx-auto max-w-md animate-pulse">
              <div className="h-4 bg-neutral-light rounded w-full"></div>
              <div className="h-4 bg-neutral-light rounded w-3/4 mt-2"></div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col space-y-4">
            {/* Welcome message */}
            <div className="text-center text-sm bg-white p-3 rounded-lg shadow-sm mx-auto max-w-md">
              Welcome to our support chat! An agent will be with you shortly. Please describe how we can help you today.
            </div>
            
            {/* Messages */}
            {messages && messages.map((message) => (
              <div key={message.id} className={`flex ${message.isFromAgent ? 'justify-start' : 'justify-end'}`}>
                <div 
                  className={`chat-bubble ${
                    message.isFromAgent ? 'bg-white shadow-sm' : 'bg-accent text-white shadow-sm'
                  }`}
                >
                  <p>{message.content}</p>
                  <div className={`text-xs ${message.isFromAgent ? 'text-neutral-dark' : 'text-white'} mt-1 text-right`}>
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Agent typing indicator */}
            {agentIsTyping && (
              <div className="flex justify-start">
                <div className="typing-indicator bg-white shadow-sm">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            
            {/* Empty reference div for scrolling to bottom */}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      
      {/* Input area */}
      <div className="p-4 bg-white border-t border-neutral-medium">
        <div className="flex rounded-lg border border-neutral-medium overflow-hidden">
          <Textarea
            placeholder="Type your message..."
            value={newMessage}
            onChange={handleMessageChange}
            onKeyDown={handleKeyPress}
            className="flex-grow p-3 outline-none resize-none border-0"
            rows={2}
          />
          <Button 
            className="bg-primary text-white px-4 flex items-center hover:bg-blue-700 rounded-none"
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
          >
            <span className="material-icons">send</span>
          </Button>
        </div>
        <div className="flex justify-between items-center mt-2 text-xs text-neutral-dark">
          <div>
            <span className="material-icons text-xs align-text-bottom">lock</span>
            Secure conversation
          </div>
          <button 
            className="text-error hover:underline"
            onClick={handleEndChat}
          >
            End Chat
          </button>
        </div>
      </div>
    </div>
  );
}
