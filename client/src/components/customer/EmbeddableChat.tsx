import { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Send, MessageSquare, RefreshCw } from "lucide-react";
import { Message, FlashbackProfile, MessageMetadata } from "@shared/schema";

interface EmbeddableChatProps {
  apiKey?: string;
  fullPage?: boolean;
  customerId?: string;
  onClose?: () => void;
}

export function EmbeddableChat({ 
  apiKey, 
  fullPage = false,
  customerId: propCustomerId,
  onClose 
}: EmbeddableChatProps) {
  const [isOpen, setIsOpen] = useState<boolean>(fullPage);
  const [customerId, setCustomerId] = useState<string>("");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [agentIsTyping, setAgentIsTyping] = useState<boolean>(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [showBirthdateForm, setShowBirthdateForm] = useState<boolean>(false);
  const [birthdate, setBirthdate] = useState<string>("");
  const [birthdateError, setBirthdateError] = useState<string>("");
  const [isUpdatingBirthdate, setIsUpdatingBirthdate] = useState<boolean>(false);
  const [flashbackProfile, setFlashbackProfile] = useState<FlashbackProfile | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Initialize customer ID and set up WebSocket connection
  useEffect(() => {
    // Use provided customer ID or get/create from session storage
    const useCustomerId = propCustomerId || sessionStorage.getItem("customerId") || `customer-${uuidv4()}`;
    
    if (!propCustomerId) {
      sessionStorage.setItem("customerId", useCustomerId);
    }
    
    setCustomerId(useCustomerId);
    
    // Clean up function
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [propCustomerId]);

  // When customer ID is available, initialize conversation and WebSocket
  useEffect(() => {
    if (!customerId) return;
    
    // Initialize conversation 
    const initializeChat = async () => {
      try {
        setIsLoading(true);
        // Check for existing conversations
        const conversations = await fetchConversations();
        
        if (conversations && conversations.length > 0) {
          // Use most recent conversation
          const conv = conversations[0];
          setConversationId(conv.id);
          
          // Fetch messages for this conversation
          const msgs = await fetchMessages(conv.id);
          if (msgs && msgs.length > 0) {
            setMessages(msgs);
          }
        } else {
          // Create a new conversation
          const newConv = await createConversation();
          setConversationId(newConv.id);
        }
        
        // Connect to WebSocket
        connectWebSocket();
      } catch (error) {
        console.error("Failed to initialize chat:", error);
        toast({
          title: "Connection Error",
          description: "Could not connect to the chat service. Please try again later.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeChat();
  }, [customerId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, agentIsTyping]);

  // API request helper function
  const apiRequest = async (method: string, endpoint: string, body?: any) => {
    try {
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      };
      
      if (body) {
        options.body = JSON.stringify(body);
      }
      
      const response = await fetch(endpoint, options);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  };

  // Fetch conversations for the customer
  const fetchConversations = async () => {
    return apiRequest('GET', `/api/partner/conversations/${customerId}`);
  };

  // Create a new conversation
  const createConversation = async () => {
    return apiRequest('POST', '/api/partner/conversations', {
      customerId
    });
  };

  // Fetch messages for a conversation
  const fetchMessages = async (convId: number) => {
    return apiRequest('GET', `/api/partner/messages/${convId}`);
  };

  // Send a message
  const sendMessage = async () => {
    if (!newMessage.trim() || !conversationId) return;

    try {
      // Check for command pattern ($command) to add metadata
      let metadata: MessageMetadata | null = null;
      const commandRegex = /\$(\w+)(?:\s+(.+))?/;
      const match = newMessage.match(commandRegex);
      
      if (match) {
        const [fullMatch, command, value] = match;
        metadata = {
          commandType: command,
          value: value || true
        };
        
        // Handle special commands
        if (command === 'dob' && value) {
          try {
            // Basic validation for date format
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              metadata.value = value;
            }
          } catch (e) {
            console.error("Invalid date format:", e);
          }
        }
      }

      // Add message to UI immediately for better UX
      const tempId = Date.now();
      const tempMessage: Message = {
        id: tempId,
        conversationId,
        senderId: customerId,
        isFromAgent: false,
        content: newMessage,
        timestamp: new Date(),
        readStatus: false,
        metadata: metadata ? JSON.stringify(metadata) as any : null
      };
      
      setMessages(prev => [...prev, tempMessage]);
      setNewMessage("");

      // Clear typing indicator
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      setIsTyping(false);
      
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ 
          type: 'typing', 
          payload: {
            conversationId,
            isTyping: false,
            isAgent: false
          }
        }));
      }

      // Send to API
      await apiRequest('POST', '/api/partner/messages', {
        conversationId,
        senderId: customerId,
        isFromAgent: false,
        content: newMessage,
        metadata: metadata ? JSON.stringify(metadata) : null
      });

    } catch (error) {
      console.error('Failed to send message:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle typing indicator
  const handleTyping = () => {
    if (!isTyping && socket && socket.readyState === WebSocket.OPEN && conversationId) {
      setIsTyping(true);
      socket.send(JSON.stringify({
        type: 'typing',
        payload: {
          conversationId,
          isTyping: true,
          isAgent: false
        }
      }));
    }
    
    // Clear previous timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    
    // Set new timeout to clear typing indicator
    const timeout = setTimeout(() => {
      setIsTyping(false);
      if (socket && socket.readyState === WebSocket.OPEN && conversationId) {
        socket.send(JSON.stringify({
          type: 'typing',
          payload: {
            conversationId,
            isTyping: false,
            isAgent: false
          }
        }));
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
      sendMessage();
    }
  };

  // Connect to WebSocket
  const connectWebSocket = () => {
    if (!customerId) return;
    
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?clientId=${customerId}`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      setIsConnected(true);
      console.log("WebSocket connected");
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'message':
            if (data.payload.conversationId === conversationId) {
              // Update messages
              setMessages(prev => {
                // Avoid duplicates 
                const exists = prev.some(m => m.id === data.payload.id);
                if (exists) return prev;
                return [...prev, data.payload];
              });
            }
            break;
          
          case 'typing':
            if (data.payload.conversationId === conversationId) {
              setAgentIsTyping(data.payload.isTyping);
            }
            break;
          
          case 'flashback':
            setFlashbackProfile(data.payload);
            toast({
              title: "Flashback Available",
              description: "We've analyzed your history based on your birthday.",
            });
            break;
            
          default:
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    ws.onclose = () => {
      setIsConnected(false);
      // Try to reconnect after a delay
      setTimeout(() => {
        if (customerId) connectWebSocket();
      }, 3000);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };
    
    setSocket(ws);
  };

  // Toggle chat widget open/closed state
  const toggleChat = () => {
    setIsOpen(prev => !prev);
  };

  // Format timestamp for display
  const formatTime = (timestamp: Date | string | null) => {
    if (!timestamp) return "--:--";
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Toggle birthdate form
  const toggleBirthdateForm = () => {
    setShowBirthdateForm(!showBirthdateForm);
    setBirthdateError("");
  };

  // Handle birthdate input change
  const handleBirthdateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBirthdate(e.target.value);
    setBirthdateError("");
  };

  // Validate birthdate
  const validateBirthdate = (date: string): boolean => {
    const parsedDate = new Date(date);
    
    // Check if date is valid
    if (isNaN(parsedDate.getTime())) {
      setBirthdateError("Please enter a valid date");
      return false;
    }
    
    // Check if date is not in the future
    if (parsedDate > new Date()) {
      setBirthdateError("Birthdate cannot be in the future");
      return false;
    }
    
    // Check if person is not too old (e.g., more than 120 years)
    const maxAge = new Date();
    maxAge.setFullYear(maxAge.getFullYear() - 120);
    if (parsedDate < maxAge) {
      setBirthdateError("Birthdate seems too far in the past");
      return false;
    }
    
    return true;
  };

  // Update customer birthdate
  const updateCustomerBirthdate = async () => {
    if (!validateBirthdate(birthdate)) return;
    
    setIsUpdatingBirthdate(true);
    
    try {
      // Update the customer profile via API
      await apiRequest('PATCH', `/api/customers/${customerId}`, { birthdate });
      
      // Fetch the flashback profile
      const response = await fetch(`/api/customers/${customerId}/flashback`);
      
      if (response.ok) {
        const data = await response.json();
        setFlashbackProfile(data);
        setShowBirthdateForm(false);
        
        toast({
          title: "Birthdate Updated",
          description: "Flashback profile is now available.",
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch flashback profile");
      }
    } catch (error) {
      console.error("Error updating birthdate:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update birthdate",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingBirthdate(false);
    }
  };

  // Handle ending the chat
  const handleEndChat = async () => {
    if (!conversationId) return;
    
    try {
      await apiRequest('PATCH', `/api/conversations/${conversationId}/status`, {
        status: 'resolved'
      });
      
      toast({
        title: "Chat Ended",
        description: "Thank you for using our support chat service.",
      });
      
      // Close the chat window
      if (!fullPage) {
        setIsOpen(false);
      }
      
      // Create a new conversation
      const newConv = await createConversation();
      setConversationId(newConv.id);
      setMessages([]);
    } catch (error) {
      console.error("Error ending chat:", error);
      toast({
        title: "Error",
        description: "Failed to end chat. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Only render the toggle button if not full page mode
  if (!fullPage && !isOpen) {
    return (
      <button
        onClick={toggleChat}
        className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg hover:bg-primary/90 transition-all"
        aria-label="Open chat"
      >
        <MessageSquare className="w-6 h-6 text-white" />
      </button>
    );
  }

  // Main chat component
  return (
    <div className={fullPage ? "h-full flex flex-col" : "w-80 h-96 rounded-lg shadow-xl flex flex-col bg-white overflow-hidden"}>
      {/* Chat header */}
      <div className="p-3 bg-primary text-white flex items-center justify-between">
        <div className="flex items-center">
          <MessageSquare className="w-5 h-5 mr-2" />
          <span className="font-medium">Chat Support</span>
        </div>
        
        <div className="flex items-center space-x-2">
          {isConnected ? (
            <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">Connected</span>
          ) : (
            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full flex items-center">
              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
              Reconnecting
            </span>
          )}
          
          {!fullPage && (
            <button 
              onClick={onClose || toggleChat} 
              aria-label="Close chat"
              className="text-white hover:text-white/80"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
      
      {/* Birthdate form panel */}
      {showBirthdateForm && !flashbackProfile && (
        <div className="bg-white p-3 border-b border-neutral-200">
          <Card className="shadow-none border">
            <CardHeader className="pb-2 px-3 pt-3">
              <CardTitle className="text-sm flex items-center">
                Enter Your Birthdate
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 py-2 space-y-2">
              <Input
                type="date"
                value={birthdate}
                onChange={handleBirthdateChange}
                className="w-full text-sm"
                placeholder="YYYY-MM-DD"
              />
              
              {birthdateError && (
                <p className="text-xs text-red-500">{birthdateError}</p>
              )}
              
              <div className="flex space-x-2">
                <Button 
                  onClick={updateCustomerBirthdate}
                  disabled={!birthdate || isUpdatingBirthdate}
                  size="sm"
                  className="text-xs"
                >
                  {isUpdatingBirthdate ? (
                    <>
                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                      Processing...
                    </>
                  ) : "Save"}
                </Button>
                <Button 
                  onClick={toggleBirthdateForm}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Messages container */}
      <div className="flex-grow p-3 overflow-y-auto bg-neutral-50">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <RefreshCw className="w-6 h-6 text-primary animate-spin mb-2" />
            <p className="text-sm text-neutral-500">Connecting...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Welcome message */}
            <div className="text-center text-xs bg-white p-2 rounded shadow-sm mx-auto max-w-[95%] text-neutral-500">
              Welcome to support chat! How can we help you today?
            </div>
            
            {/* Messages */}
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.isFromAgent ? 'justify-start' : 'justify-end'}`}>
                <div 
                  className={`rounded-lg px-3 py-2 max-w-[90%] shadow-sm ${
                    message.isFromAgent ? 'bg-white text-neutral-800' : 'bg-primary text-white'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  
                  {/* Display metadata if available */}
                  {message.metadata && (
                    <div className={`text-xs ${message.isFromAgent ? 'text-neutral-500' : 'text-white/80'} mt-1 border-t ${message.isFromAgent ? 'border-neutral-200' : 'border-white/20'} pt-1`}>
                      {(() => {
                        // Parse metadata if it's a string
                        let metadataObj: MessageMetadata;
                        try {
                          metadataObj = typeof message.metadata === 'string' 
                            ? JSON.parse(message.metadata)
                            : message.metadata;
                          
                          if (metadataObj.commandType) {
                            return (
                              <div className="flex items-center">
                                <span>Command: {metadataObj.commandType}</span>
                                {metadataObj.value && metadataObj.value !== true && (
                                  <span className="ml-1">({typeof metadataObj.value === 'string' ? metadataObj.value : JSON.stringify(metadataObj.value)})</span>
                                )}
                              </div>
                            );
                          }
                        } catch (e) {
                          console.error("Error parsing metadata:", e);
                          return null;
                        }
                        return null;
                      })()}
                    </div>
                  )}
                  
                  <div className={`text-xs ${message.isFromAgent ? 'text-neutral-400' : 'text-white/80'} mt-1 text-right`}>
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Agent typing indicator */}
            {agentIsTyping && (
              <div className="flex justify-start">
                <div className="bg-white rounded-lg px-4 py-2 shadow-sm flex items-center space-x-1">
                  <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce"></div>
                </div>
              </div>
            )}
            
            {/* Empty reference div for scrolling to bottom */}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      
      {/* Input area */}
      <div className="p-3 bg-white border-t border-neutral-200">
        <div className="flex rounded border border-neutral-200 overflow-hidden">
          <Textarea
            placeholder="Type your message..."
            value={newMessage}
            onChange={handleMessageChange}
            onKeyDown={handleKeyPress}
            className="min-h-[60px] max-h-24 flex-grow p-2 text-sm border-0 resize-none focus-visible:ring-0"
          />
          <Button 
            className="rounded-none px-3"
            onClick={sendMessage}
            disabled={!newMessage.trim() || !isConnected}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex justify-between items-center mt-2 text-xs text-neutral-500">
          <div className="flex items-center">
            {!flashbackProfile && (
              <button 
                onClick={toggleBirthdateForm} 
                className="mr-2 text-primary hover:underline flex items-center"
              >
                Add birthdate
              </button>
            )}
          </div>
          <button 
            onClick={handleEndChat}
            className="text-red-500 hover:underline"
          >
            End Chat
          </button>
        </div>
      </div>
    </div>
  );
}