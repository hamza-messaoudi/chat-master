import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Message, Conversation, CannedResponse, LlmPrompt, FlashbackProfile } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import WebSocketClient from "@/lib/websocket";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "../../contexts/NotificationContext";
import { apiRequest } from "@/lib/queryClient";

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
  const [isGeneratingLlmResponse, setIsGeneratingLlmResponse] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isAutomationActive, setIsAutomationActive] = useState(true);
  const [automationDelay, setAutomationDelay] = useState(60); // seconds
  const [automationCountdown, setAutomationCountdown] = useState<number | null>(null);
  const [newPromptTitle, setNewPromptTitle] = useState("");
  const [newPromptContent, setNewPromptContent] = useState("");
  const [newPromptCategory, setNewPromptCategory] = useState("general");
  const [showNewPromptForm, setShowNewPromptForm] = useState(false);
  const [flashbackProfile, setFlashbackProfile] = useState<FlashbackProfile | null>(null);
  const [showFlashback, setShowFlashback] = useState(false);
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
  
  // Fetch customer flashback data when conversation is loaded
  useEffect(() => {
    if (conversation?.customerId) {
      fetch(`/api/customers/${conversation.customerId}/flashback`)
        .then(res => {
          if (res.ok) return res.json();
          throw new Error("Failed to fetch flashback");
        })
        .then(data => {
          setFlashbackProfile(data);
        })
        .catch(err => {
          console.error("Error fetching flashback profile:", err);
        });
    }
  }, [conversation?.customerId]);
  
  // Fetch messages
  const { data: messages, isLoading: isLoadingMessages } = useQuery<Message[]>({
    queryKey: [`/api/conversations/${conversationId}/messages`],
  });
  
  // Fetch canned responses
  const { data: cannedResponses } = useQuery<CannedResponse[]>({
    queryKey: [`/api/canned-responses/${agentId}`],
  });
  
  // Fetch LLM prompts
  const { data: llmPrompts } = useQuery<LlmPrompt[]>({
    queryKey: [`/api/llm-prompts/${agentId}`],
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
      }
      
      // Send via WebSocket
      webSocketClient.send('message', {
        conversationId,
        content: newMessage,
        senderId: `agent-${agentId}`,
        isFromAgent: true,
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
  
  // Generate LLM response
  const generateLlmResponse = useMutation({
    mutationFn: async (data: { promptId?: number; customPrompt?: string }) => {
      const payload = {
        conversationId,
        ...(data.promptId && { promptId: data.promptId }),
        ...(data.customPrompt && { customPrompt: data.customPrompt }),
      };
      
      const response = await fetch('/api/llm/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate LLM response');
      }
      
      const responseData = await response.json();
      return responseData as { response: string };
    },
    onSuccess: (data: { response: string }) => {
      setNewMessage(data.response);
      setIsGeneratingLlmResponse(false);
      toast({
        title: "Response Generated",
        description: "AI-generated response has been added to your input",
      });
    },
    onError: (error) => {
      console.error('Error generating LLM response:', error);
      setIsGeneratingLlmResponse(false);
      toast({
        title: "Error",
        description: "Failed to generate AI response. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Handle selecting an LLM prompt
  const handleSelectLlmPrompt = (prompt: LlmPrompt) => {
    setIsGeneratingLlmResponse(true);
    generateLlmResponse.mutate({ promptId: prompt.id });
  };
  
  // Handle submitting a custom prompt
  const handleSubmitCustomPrompt = () => {
    if (!customPrompt.trim()) return;
    
    setIsGeneratingLlmResponse(true);
    generateLlmResponse.mutate({ customPrompt });
    setCustomPrompt("");
  };
  
  // Save a new LLM prompt template
  const createLlmPrompt = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/llm-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          title: newPromptTitle,
          prompt: newPromptContent,
          category: newPromptCategory
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create new LLM prompt template');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      // Reset form fields
      setNewPromptTitle("");
      setNewPromptContent("");
      setNewPromptCategory("general");
      setShowNewPromptForm(false);
      
      // Invalidate cache to refresh prompts list
      queryClient.invalidateQueries({ queryKey: [`/api/llm-prompts/${agentId}`] });
      
      toast({
        title: "Prompt Template Saved",
        description: "Your new prompt template has been saved successfully.",
      });
    },
    onError: (error) => {
      console.error('Error saving prompt template:', error);
      toast({
        title: "Error",
        description: "Failed to save prompt template. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Handle saving a new prompt template
  const handleSavePrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromptTitle.trim() || !newPromptContent.trim()) return;
    
    createLlmPrompt.mutate();
  };
  
  // Toggle automation mode
  const toggleAutomation = () => {
    setIsAutomationActive(!isAutomationActive);
    toast({
      title: isAutomationActive ? "Automation Disabled" : "Automation Enabled",
      description: isAutomationActive 
        ? "Automated responses have been turned off." 
        : `Automated responses will be sent after ${automationDelay} seconds of customer inactivity.`,
    });
  };
  
  // Handle automation response when customer is inactive
  useEffect(() => {
    let automationTimer: NodeJS.Timeout | null = null;
    let countdownInterval: NodeJS.Timeout | null = null;
    
    // Only set up automation if it's active and we have customer messages
    if (isAutomationActive && messages && messages.length > 0) {
      // Get last message
      const lastMessage = messages[messages.length - 1];
      
      // Only respond to customer messages automatically
      if (!lastMessage.isFromAgent) {
        // Set initial countdown
        setAutomationCountdown(automationDelay);
        
        // Setup countdown timer
        countdownInterval = setInterval(() => {
          setAutomationCountdown((prev) => {
            if (prev === null || prev <= 1) {
              if (countdownInterval) clearInterval(countdownInterval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        
        // Start timer for automated response
        automationTimer = setTimeout(() => {
          // Clear countdown 
          setAutomationCountdown(null);
          if (countdownInterval) clearInterval(countdownInterval);
          
          // Find an appropriate LLM prompt to use (we'll use the first available one)
          if (llmPrompts && llmPrompts.length > 0) {
            handleSelectLlmPrompt(llmPrompts[0]);
          } else {
            // Use a default prompt if no templates are available
            generateLlmResponse.mutate({ 
              customPrompt: "Please provide a helpful response to the customer's inquiry." 
            });
          }
        }, automationDelay * 1000);
      }
    } else {
      // Reset countdown if automation is disabled
      setAutomationCountdown(null);
    }
    
    // Clean up timers if component unmounts or dependencies change
    return () => {
      if (automationTimer) {
        clearTimeout(automationTimer);
      }
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
    };
  }, [isAutomationActive, messages, automationDelay, llmPrompts]);
  
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
      
      // Add handlers specifically for this chat window
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
        },
        onFlashback: (data) => {
          // When flashback data is received via WebSocket
          if (conversation?.customerId && data) {
            setFlashbackProfile(data);
            setShowFlashback(true);
            
            toast({
              title: "Flashback Available",
              description: "Customer personality insights are now available",
            });
          }
        }
      });
      
      // Restore original handlers on unmount
      return () => {
        webSocketClient.setEventHandlers(originalEventHandlers);
      };
    }
  }, [webSocketClient, conversationId, conversation?.customerId]);
  
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
              
              {/* Flashback indicator */}
              {flashbackProfile && (
                <div 
                  className="flex items-center mt-1 text-xs cursor-pointer text-blue-600"
                  onClick={() => setShowFlashback(!showFlashback)}
                >
                  <span className="material-icons text-xs mr-1">history</span>
                  <span>Personality Flashback</span>
                </div>
              )}
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
      
      {/* Flashback Profile Panel */}
      {showFlashback && flashbackProfile && (
        <div className="bg-blue-50 border-b border-blue-200 p-3 text-sm">
          <div className="mb-2 flex justify-between items-center">
            <div className="font-medium text-blue-800 flex items-center">
              <span className="material-icons text-sm mr-1">psychology</span>
              Customer Personality Insights
            </div>
            <button 
              className="text-blue-600 hover:text-blue-800 text-xs"
              onClick={() => setShowFlashback(false)}
            >
              Hide
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {flashbackProfile.flashBack && (
              <>
                <div className="bg-white p-2 rounded shadow-sm">
                  <div className="text-xs text-blue-700 mb-1">First Significant Event</div>
                  <div className="flex items-center justify-between">
                    <div className="text-blue-900 font-medium">
                      {flashbackProfile.flashBack.firstEventTrait}
                    </div>
                    <div className="text-xs text-neutral-dark">
                      {flashbackProfile.flashBack.firstEventDate.month} {flashbackProfile.flashBack.firstEventDate.year}
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-2 rounded shadow-sm">
                  <div className="text-xs text-blue-700 mb-1">Second Significant Event</div>
                  <div className="flex items-center justify-between">
                    <div className="text-blue-900 font-medium">
                      {flashbackProfile.flashBack.secondEventTrait}
                    </div>
                    <div className="text-xs text-neutral-dark">
                      {flashbackProfile.flashBack.secondEventDate.month} {flashbackProfile.flashBack.secondEventDate.year}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          
          <div className="mt-2 text-xs text-blue-600 italic">
            These insights are generated based on the customer's birth date and can help personalize your communication.
          </div>
        </div>
      )}
      
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
                      
                      {/* Display metadata if available */}
                      {message.metadata && typeof message.metadata === 'object' && (
                        <div className={`text-xs ${message.isFromAgent ? 'text-white/90' : 'text-neutral-dark/90'} mt-1 border-t ${message.isFromAgent ? 'border-white/20' : 'border-gray-200'} pt-1`}>
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
      
      {/* Unified Action Bar with Input Field */}
      <div className="bg-white border-t border-neutral-medium">
        {/* Automation Control Bar */}
        <div className="flex items-center justify-between p-2 bg-gray-50 border-b border-neutral-light">
          <div className="flex items-center gap-2">          
            {/* Combined Take Over Button with Counter */}
            {isAutomationActive && automationCountdown !== null ? (
              <Button 
                variant="destructive" 
                size="sm" 
                className="h-7 rounded-full text-xs font-medium animate-pulse flex items-center"
                onClick={() => {
                  setIsAutomationActive(false);
                  setAutomationCountdown(null);
                  toast({
                    title: "Manual Mode Activated",
                    description: "You have taken control of the conversation.",
                  });
                }}
              >
                <span className="material-icons text-xs mr-1">pan_tool</span>
                <span className="mr-1">Take Over</span>
                <Badge 
                  variant="outline" 
                  className="h-5 ml-1 text-xs bg-white/20 flex items-center gap-0.5 border-white/30"
                >
                  <span className="material-icons text-xs">timer</span>
                  <span>{automationCountdown}s</span>
                </Badge>
              </Button>
            ) : isAutomationActive ? (
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 rounded-md text-xs font-medium flex items-center border-green-200 bg-green-50 text-green-700"
              >
                <span className="material-icons text-xs mr-1">auto_awesome</span>
                <span className="mr-1">Auto Mode</span>
              </Button>
            ) : null}
          </div>
          
          <div className="flex items-center gap-1.5">
            {/* AI response popover (compact) */}
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 w-7 p-0 rounded-full flex-shrink-0"
                  aria-label="AI Responses"
                >
                  <span className="material-icons text-sm">smart_toy</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 sm:w-80">
                <Tabs defaultValue="templates">
                  <TabsList className="w-full">
                    <TabsTrigger value="templates" className="flex-1">Templates</TabsTrigger>
                    <TabsTrigger value="custom" className="flex-1">Custom</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="templates" className="mt-2">
                    <div className="max-h-60 overflow-y-auto">
                      {isGeneratingLlmResponse && (
                        <div className="p-4 flex justify-center">
                          <div className="typing-indicator">
                            <span></span>
                            <span></span>
                            <span></span>
                          </div>
                        </div>
                      )}
                      
                      {!isGeneratingLlmResponse && llmPrompts && llmPrompts.length > 0 ? (
                        llmPrompts.map((prompt) => (
                          <div 
                            key={prompt.id} 
                            className="p-2 hover:bg-neutral-light cursor-pointer"
                            onClick={() => handleSelectLlmPrompt(prompt)}
                          >
                            <div className="font-medium">{prompt.title}</div>
                            <div className="text-sm text-neutral-dark truncate">{prompt.prompt}</div>
                          </div>
                        ))
                      ) : (
                        !isGeneratingLlmResponse && (
                          <div className="p-2 text-neutral-dark">
                            No AI templates available. Create some for intelligent responses.
                          </div>
                        )
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="custom" className="mt-2">
                    <div className="p-2">
                      <div className="mb-2 text-sm font-medium">Create a custom AI prompt</div>
                      <Textarea
                        placeholder="E.g., Generate a response that explains our refund policy in simple terms..."
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        className="min-h-[100px] mb-2"
                      />
                      <Button 
                        className="w-full" 
                        onClick={handleSubmitCustomPrompt}
                        disabled={isGeneratingLlmResponse || !customPrompt.trim()}
                      >
                        {isGeneratingLlmResponse ? (
                          <div className="flex items-center gap-2">
                            <span className="material-icons animate-spin text-xs">refresh</span>
                            <span>Generating...</span>
                          </div>
                        ) : "Generate Response"}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </PopoverContent>
            </Popover>
            
            {/* Automation Settings Popover (compact) */}
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant={isAutomationActive ? "outline" : "ghost"}
                  size="sm" 
                  className={`h-7 w-7 p-0 rounded-full ${isAutomationActive ? "border-green-500 bg-green-50" : ""}`}
                  aria-label="Automation Settings"
                >
                  <span className={`material-icons text-sm ${isAutomationActive ? "text-green-600" : ""}`}>settings</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-4 p-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Automation Settings</h3>
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={isAutomationActive}
                        onCheckedChange={toggleAutomation}
                        id="automation-toggle"
                      />
                      <Label 
                        htmlFor="automation-toggle" 
                        className={`text-xs font-medium ${isAutomationActive ? 'text-green-600' : 'text-gray-500'}`}
                      >
                        {isAutomationActive ? 'Enabled' : 'Disabled'}
                      </Label>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="response-delay">Response Delay (seconds)</Label>
                    <div className="flex items-center gap-2">
                      <Slider 
                        id="response-delay"
                        min={5}
                        max={120} 
                        step={5}
                        value={[automationDelay]} 
                        onValueChange={(value) => setAutomationDelay(value[0])}
                        className="flex-grow"
                      />
                      <span className="text-sm w-8 text-center">{automationDelay}s</span>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Prompt Templates</Label>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs h-6"
                        onClick={() => setShowNewPromptForm(!showNewPromptForm)}
                      >
                        {showNewPromptForm ? 'Cancel' : '+ New'}
                      </Button>
                    </div>
                    
                    {showNewPromptForm ? (
                      <form onSubmit={handleSavePrompt} className="space-y-3 border rounded-md p-2 bg-gray-50">
                        <div className="space-y-1">
                          <Label htmlFor="prompt-title" className="text-xs">Title</Label>
                          <Input
                            id="prompt-title"
                            value={newPromptTitle}
                            onChange={(e) => setNewPromptTitle(e.target.value)}
                            placeholder="E.g., Standard Greeting"
                            className="h-8 text-sm"
                          />
                        </div>
                        
                        <div className="space-y-1">
                          <Label htmlFor="prompt-category" className="text-xs">Category</Label>
                          <Select 
                            value={newPromptCategory} 
                            onValueChange={setNewPromptCategory}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="general">General</SelectItem>
                              <SelectItem value="greeting">Greeting</SelectItem>
                              <SelectItem value="troubleshooting">Troubleshooting</SelectItem>
                              <SelectItem value="billing">Billing</SelectItem>
                              <SelectItem value="product">Product Info</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-1">
                          <Label htmlFor="prompt-content" className="text-xs">Prompt Template</Label>
                          <Textarea
                            id="prompt-content"
                            value={newPromptContent}
                            onChange={(e) => setNewPromptContent(e.target.value)}
                            placeholder="Instructions for the AI to generate a response..."
                            className="min-h-[80px] text-sm"
                          />
                        </div>
                        
                        <Button 
                          type="submit" 
                          size="sm" 
                          className="w-full"
                          disabled={!newPromptTitle.trim() || !newPromptContent.trim() || createLlmPrompt.isPending}
                        >
                          {createLlmPrompt.isPending ? (
                            <div className="flex items-center gap-2">
                              <span className="material-icons animate-spin text-xs">refresh</span>
                              <span>Saving...</span>
                            </div>
                          ) : "Save Template"}
                        </Button>
                      </form>
                    ) : (
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {llmPrompts && llmPrompts.length > 0 ? (
                          llmPrompts.map((prompt) => (
                            <div 
                              key={prompt.id} 
                              className="text-sm border rounded-md p-2 flex justify-between items-center"
                              onClick={() => handleSelectLlmPrompt(prompt)}
                            >
                              <div>
                                <div className="font-medium">{prompt.title}</div>
                                <div className="text-xs text-gray-500">{prompt.category}</div>
                              </div>
                              <Badge variant="outline" className="text-xs">{prompt.category}</Badge>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-gray-500 italic">
                            No templates available. Create one to get started.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        
        {/* Clean Message Input Field */}
        <div className="p-2 sm:p-3">
          <div className="flex items-center gap-2">
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
    </div>
  );
}
