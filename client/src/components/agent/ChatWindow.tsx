import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Message, Conversation, CannedResponse } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import WebSocketClient from "@/lib/websocket";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "../../contexts/NotificationContext";

interface ChatWindowProps {
  conversationId: number;
  agentId: number;
  webSocketClient: WebSocketClient | null;
  onBack?: () => void;
}

export default function ChatWindow({ conversationId, agentId, webSocketClient, onBack }: ChatWindowProps) {
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [customerIsTyping, setCustomerIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { addNotification } = useNotifications();
  
  // Fetch conversation details
  const { data: conversation } = useQuery<Conversation>({
    queryKey: [`/api/conversations/${conversationId}`],
    queryFn: async () => {
      const response = await fetch(`/api/conversations/${conversationId}`);
      if (!response.ok) throw new Error("Failed to fetch conversation");
      return response.json();
    },
  });
  
  // Fetch messages
  const { data: messages, isLoading: isLoadingMessages } = useQuery<Message[]>({
    queryKey: [`/api/conversations/${conversationId}/messages`],
  });
  
  // Fetch canned responses
  const { data: cannedResponses } = useQuery<CannedResponse[]>({
    queryKey: [`/api/canned-responses/${agentId}`],
  });
  
  // Scroll to bottom when messages change and mark messages as read
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Mark unread messages as read
    if (messages && messages.length > 0) {
      messages.forEach(message => {
        if (!message.readStatus && !message.isFromAgent) {
          markMessageAsRead(message.id);
        }
      });
    }
  }, [messages]);
  
  // Function to mark a message as read
  const markMessageAsRead = async (messageId: number) => {
    try {
      await fetch(`/api/messages/${messageId}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Invalidate queries to update UI
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}/messages`] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-messages'] });
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };
  
  // Handle sending a message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !webSocketClient) return;
    
    try {
      // Send via WebSocket
      webSocketClient.send('message', {
        conversationId,
        content: newMessage,
        senderId: `agent-${agentId}`,
        isFromAgent: true
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
        isAgent: true
      });
      
    } catch (error) {
      console.error("Error sending message:", error);
      addNotification(
        "Error",
        "Failed to send message. Please try again.",
        "system"
      );
    }
  };
  
  // Handle typing indicator
  const handleTyping = () => {
    if (!isTyping && webSocketClient) {
      setIsTyping(true);
      webSocketClient.send('typing', {
        conversationId,
        isTyping: true,
        isAgent: true
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
          isAgent: true
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
  
  // Handle selecting a canned response
  const handleSelectCannedResponse = (response: CannedResponse) => {
    setNewMessage(response.content);
  };
  
  // Handle marking a conversation as resolved
  const handleResolveConversation = async () => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' }),
      });
      
      if (!response.ok) throw new Error("Failed to resolve conversation");
      
      // Update the conversation in cache
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      
      addNotification(
        "Conversation Resolved",
        "The conversation has been marked as resolved.",
        "status"
      );
    } catch (error) {
      console.error("Error resolving conversation:", error);
      addNotification(
        "Error",
        "Failed to resolve conversation.",
        "system"
      );
    }
  };
  
  // Format timestamp for display
  const formatTime = (timestamp: Date | null) => {
    if (!timestamp) return "--:--";
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Set up WebSocket event listeners for this specific conversation
  useEffect(() => {
    if (webSocketClient) {
      const originalEventHandlers = webSocketClient.getEventHandlers();
      
      // Add typing indicator handler specifically for this chat window
      webSocketClient.setEventHandlers({
        ...originalEventHandlers,
        onTyping: (typingData) => {
          // Call original handler first
          originalEventHandlers.onTyping(typingData);
          
          // Then handle specifically for this conversation
          if (typingData.conversationId === conversationId) {
            setCustomerIsTyping(typingData.isTyping);
            
            // Auto clear typing indicator after 5 seconds as a fallback
            if (typingData.isTyping) {
              setTimeout(() => {
                setCustomerIsTyping(false);
              }, 5000);
            }
          }
        }
      });
      
      // Restore original handlers on unmount
      return () => {
        webSocketClient.setEventHandlers(originalEventHandlers);
      };
    }
  }, [webSocketClient, conversationId]);
  
  // Group messages by date for displaying message groups
  const groupedMessages = messages?.reduce((groups, message) => {
    // Ensure timestamp is valid before creating a Date object
    const timestamp = message.timestamp ? new Date(message.timestamp) : new Date();
    const date = timestamp.toLocaleDateString();
    
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {} as Record<string, Message[]>) || {};
  
  return (
    <div className="flex flex-col h-full bg-neutral-light">
      {/* Chat header */}
      <div className="p-3 bg-white border-b border-neutral-medium">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            {onBack && (
              <button 
                onClick={onBack}
                className="mr-2 text-neutral-dark hover:text-primary"
                aria-label="Back to conversation list"
              >
                <span className="material-icons">arrow_back</span>
              </button>
            )}
            <div>
              <h2 className="font-medium text-sm sm:text-base">
                Customer #{conversation?.customerId.slice(0, 6) || "Loading..."}
              </h2>
              <div className="text-xs sm:text-sm text-neutral-dark">
                {conversation && conversation.createdAt ? 
                  `Started ${formatDistanceToNow(new Date(conversation.createdAt), { addSuffix: true })}` : 
                  "Loading..."}
              </div>
            </div>
          </div>
          
          {/* Mobile action button */}
          <div className="md:hidden">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                  <span className="material-icons">more_vert</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48">
                <div className="space-y-2">
                  <button className="w-full text-left flex items-center gap-2 p-2 hover:bg-neutral-100 rounded-md" onClick={() => {}}>
                    <span className="material-icons text-sm">history</span>
                    <span>History</span>
                  </button>
                  <button className="w-full text-left flex items-center gap-2 p-2 hover:bg-neutral-100 rounded-md" onClick={() => {}}>
                    <span className="material-icons text-sm">supervisor_account</span>
                    <span>Transfer</span>
                  </button>
                  <button 
                    className="w-full text-left flex items-center gap-2 p-2 hover:bg-green-100 text-green-700 rounded-md"
                    onClick={handleResolveConversation}
                  >
                    <span className="material-icons text-sm">check_circle</span>
                    <span>Resolve</span>
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          {/* Desktop action buttons */}
          <div className="hidden md:flex space-x-2">
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <span className="material-icons text-sm">history</span>
              <span>History</span>
            </Button>
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <span className="material-icons text-sm">supervisor_account</span>
              <span>Transfer</span>
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              className="bg-success hover:bg-green-600 text-white flex items-center gap-1"
              onClick={handleResolveConversation}
            >
              <span className="material-icons text-sm">check_circle</span>
              <span>Resolve</span>
            </Button>
          </div>
        </div>
      </div>
      
      {/* Chat messages */}
      <div className="flex-grow p-2 sm:p-4 overflow-y-auto custom-scrollbar">
        {isLoadingMessages ? (
          <div className="flex flex-col space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                  <div className={`rounded-lg p-3 max-w-[80%] sm:max-w-xs ${i % 2 === 0 ? 'bg-neutral-medium' : 'bg-blue-100'}`}>
                    <div className="h-3 bg-neutral-light rounded w-full"></div>
                    <div className="h-3 bg-neutral-light rounded w-3/4 mt-2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col space-y-3">
            {/* Conversation start message */}
            <div className="text-center text-xs sm:text-sm text-neutral-dark py-2">
              Conversation started at {conversation && conversation.createdAt ? new Date(conversation.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}
            </div>
            
            {/* Messages grouped by date */}
            {Object.entries(groupedMessages).map(([date, dateMessages]) => (
              <div key={date}>
                <div className="text-center text-xs text-neutral-dark my-2">
                  {new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                </div>
                
                {dateMessages.map((message) => (
                  <div key={message.id} className={`flex ${message.isFromAgent ? 'justify-end' : 'justify-start'} mb-2`}>
                    <div 
                      className={`rounded-xl p-3 ${
                        message.isFromAgent 
                          ? 'bg-primary text-white rounded-tr-none' 
                          : 'bg-white shadow-sm rounded-tl-none'
                      } max-w-[80%] sm:max-w-xs break-words`}
                    >
                      <p className="text-sm sm:text-base">{message.content}</p>
                      <div className={`text-xs ${message.isFromAgent ? 'text-white opacity-80' : 'text-neutral-dark'} mt-1 text-right`}>
                        {formatTime(message.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            
            {/* Customer typing indicator */}
            {customerIsTyping && (
              <div className="flex justify-start">
                <div className="typing-indicator bg-white shadow-sm rounded-xl p-2">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            
            {/* Empty reference div for scrolling to bottom */}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        )}
      </div>
      
      {/* Response tools and input */}
      <div className="bg-white border-t border-neutral-medium p-2 sm:p-3">
        <div className="flex items-center gap-2">
          {/* Canned responses dropdown */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8 rounded-full flex-shrink-0"
                aria-label="Canned Responses"
              >
                <span className="material-icons text-sm">bolt</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 sm:w-80">
              <div className="max-h-60 overflow-y-auto">
                {cannedResponses && cannedResponses.length > 0 ? (
                  cannedResponses.map((response) => (
                    <div 
                      key={response.id} 
                      className="p-2 hover:bg-neutral-light cursor-pointer"
                      onClick={() => handleSelectCannedResponse(response)}
                    >
                      <div className="font-medium">{response.title}</div>
                      <div className="text-sm text-neutral-dark truncate">{response.content}</div>
                    </div>
                  ))
                ) : (
                  <div className="p-2 text-neutral-dark">
                    No canned responses available. Create some for quick replies.
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
          
          {/* Message input and send button */}
          <div className="flex-1 flex items-center gap-2 bg-neutral-50 rounded-full border border-neutral-medium overflow-hidden shadow-sm">
            <Textarea
              placeholder="Type your message..."
              value={newMessage}
              onChange={handleMessageChange}
              onKeyDown={handleKeyPress}
              className="flex-grow py-2 px-4 resize-none text-sm min-h-0 border-none focus-visible:ring-0 bg-transparent"
              rows={1}
            />
            <Button 
              className="rounded-full h-8 w-8 p-0 flex items-center justify-center bg-primary text-white hover:bg-primary/90 mr-1"
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              size="icon"
            >
              <span className="material-icons text-sm">send</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
