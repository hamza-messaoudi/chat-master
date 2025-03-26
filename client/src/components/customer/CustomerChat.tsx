import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import WebSocketClient from "@/lib/websocket";
import { Message, FlashbackProfile } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

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
  const [flashbackProfile, setFlashbackProfile] = useState<FlashbackProfile | null>(null);
  const [showFlashback, setShowFlashback] = useState(false);
  const [birthdate, setBirthdate] = useState("");
  const [birthdateError, setBirthdateError] = useState("");
  const [showBirthdateForm, setShowBirthdateForm] = useState(false);
  const [isUpdatingBirthdate, setIsUpdatingBirthdate] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch messages
  const { data: messages, isLoading: isLoadingMessages } = useQuery<Message[]>({
    queryKey: [`/api/conversations/${conversationId}/messages`],
  });
  
  // Fetch customer flashback data
  const { data: customer } = useQuery<{ birthdate?: string | Date }>({
    queryKey: [`/api/customers/${customerId}`],
  });

  // Fetch flashback profile if customer exists and has birthdate
  useEffect(() => {
    if (customer && customer.birthdate) {
      fetch(`/api/customers/${customerId}/flashback`)
        .then(res => res.json())
        .then(data => {
          setFlashbackProfile(data);
        })
        .catch(err => {
          console.error("Error fetching flashback profile:", err);
        });
    }
  }, [customer, customerId]);

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
      onFlashback: (data) => {
        setFlashbackProfile(data);
        setShowFlashback(true);
        
        toast({
          title: "Flashback Available",
          description: "We've analyzed your history based on your birthday.",
        });
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
      // Check for command pattern ($command) to add metadata
      let metadata = null;
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
          // For date of birth command, add special formatting
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
      
      // Send via WebSocket
      webSocketClient.send('message', {
        conversationId,
        content: newMessage,
        senderId: customerId,
        isFromAgent: false,
        metadata
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
  
  // Toggle flashback view
  const toggleFlashbackView = () => {
    setShowFlashback(!showFlashback);
  };
  
  // Toggle birthdate form visibility
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
      await fetch(`/api/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthdate }),
      });
      
      // Fetch the flashback profile
      const response = await fetch(`/api/customers/${customerId}/flashback`);
      
      if (response.ok) {
        const data = await response.json();
        setFlashbackProfile(data);
        setShowFlashback(true);
        setShowBirthdateForm(false);
        
        toast({
          title: "Birthdate Updated",
          description: "Flashback profile is now available.",
        });
        
        // Invalidate customer data to refresh
        queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}`] });
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

  return (
    <div className="flex flex-col h-screen bg-neutral-light">
      {/* Chat header */}
      <div className="p-4 bg-primary text-white shadow-md flex items-center">
        <span className="material-icons mr-2">support_agent</span>
        <h1 className="text-xl">Support Chat</h1>
        <div className="ml-auto flex items-center">
          {flashbackProfile ? (
            <button 
              onClick={toggleFlashbackView} 
              className="mr-3 text-xs bg-accent text-white px-2 py-1 rounded-full flex items-center"
            >
              <span className="material-icons text-xs mr-1">history</span>
              Flashback
            </button>
          ) : (
            <button 
              onClick={toggleBirthdateForm} 
              className="mr-3 text-xs bg-white text-primary px-2 py-1 rounded-full flex items-center"
            >
              <span className="material-icons text-xs mr-1">cake</span>
              Add Birthdate
            </button>
          )}
          {isConnected ? (
            <span className="text-xs bg-success text-white px-2 py-1 rounded-full">Connected</span>
          ) : (
            <span className="text-xs bg-error text-white px-2 py-1 rounded-full">Reconnecting...</span>
          )}
        </div>
      </div>
      
      {/* Birthdate form panel */}
      {showBirthdateForm && !flashbackProfile && (
        <div className="bg-white p-4 border-b border-neutral-medium">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <span className="material-icons mr-2 text-primary">cake</span>
                Enter Customer's Birthdate
              </CardTitle>
              <CardDescription>
                Entering a birthdate will provide additional personalized insights for this customer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col space-y-4">
                <div>
                  <Input
                    type="date"
                    value={birthdate}
                    onChange={handleBirthdateChange}
                    className="w-full"
                    placeholder="YYYY-MM-DD"
                  />
                  {birthdateError && (
                    <p className="text-sm text-error mt-1">{birthdateError}</p>
                  )}
                </div>
                <div className="flex space-x-2">
                  <Button 
                    onClick={updateCustomerBirthdate}
                    disabled={!birthdate || isUpdatingBirthdate}
                    className="bg-primary text-white"
                  >
                    {isUpdatingBirthdate ? (
                      <>
                        <span className="material-icons animate-spin mr-2">refresh</span>
                        Processing...
                      </>
                    ) : "Save Birthdate"}
                  </Button>
                  <Button 
                    onClick={toggleBirthdateForm}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
                <div className="text-xs text-neutral-dark mt-2">
                  <span className="material-icons text-xs align-text-bottom mr-1">info</span>
                  The birthdate will be used to generate a flashback profile with key events from the customer's past.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Flashback panel */}
      {showFlashback && flashbackProfile && (
        <div className="bg-white p-4 border-b border-neutral-medium">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <span className="material-icons mr-2 text-accent">history</span>
                Customer Flashback Analysis
              </CardTitle>
              <CardDescription>
                Based on birthday information and numerology patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded p-3">
                  <h3 className="text-sm font-medium mb-2 text-neutral-dark">First Event: {flashbackProfile.flashBack.firstEventDate.month} {flashbackProfile.flashBack.firstEventDate.year}</h3>
                  <p className="text-sm">{flashbackProfile.flashBack.firstEventTrait}</p>
                </div>
                <div className="border rounded p-3">
                  <h3 className="text-sm font-medium mb-2 text-neutral-dark">Second Event: {flashbackProfile.flashBack.secondEventDate.month} {flashbackProfile.flashBack.secondEventDate.year}</h3>
                  <p className="text-sm">{flashbackProfile.flashBack.secondEventTrait}</p>
                </div>
              </div>
              <div className="mt-3 text-xs text-neutral-dark">
                This information may help provide more personalized support for the customer.
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
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
                  
                  {/* Display metadata if available */}
                  {message.metadata && (
                    <div className={`text-xs ${message.isFromAgent ? 'text-neutral-dark/90' : 'text-white/90'} mt-1 border-t ${message.isFromAgent ? 'border-gray-200' : 'border-white/20'} pt-1`}>
                      {message.metadata.commandType && (
                        <div className="flex items-center">
                          <span className="material-icons text-xs mr-1">code</span>
                          <span>Command: {message.metadata.commandType}</span>
                          {message.metadata.value && message.metadata.value !== true && (
                            <span className="ml-1">({typeof message.metadata.value === 'string' ? message.metadata.value : JSON.stringify(message.metadata.value)})</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
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
