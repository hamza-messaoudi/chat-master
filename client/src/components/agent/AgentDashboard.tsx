import { useState, useEffect } from "react";
import Header from "./Header";
import ConversationList from "./ConversationList";
import ChatWindow from "./ChatWindow";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import WebSocketClient from "@/lib/websocket";
import { ConversationWithLastMessage } from "@/types/chat";
import { Message, Conversation } from "@shared/schema";
import { useIsMobile } from "@/hooks/use-mobile";

interface AgentDashboardProps {
  agentId: number;
  onLogout: () => void;
}

export default function AgentDashboard({ agentId, onLogout }: AgentDashboardProps) {
  const [activeConversation, setActiveConversation] = useState<number | null>(null);
  const [showConversationList, setShowConversationList] = useState(true);
  const [webSocketClient, setWebSocketClient] = useState<WebSocketClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  // Set up WebSocket connection
  useEffect(() => {
    const client = new WebSocketClient(`agent-${agentId}`);
    
    client.setEventHandlers({
      onMessage: (message) => {
        console.log("WebSocket message received:", message);
        
        // Update the message cache
        queryClient.invalidateQueries({ queryKey: [`/api/conversations/${message.conversationId}/messages`] });
        
        // Update the conversation list to reflect new message
        queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
        
        // For new conversations, force refetch to ensure it appears in the list
        if (!allConversations?.some(conv => conv.id === message.conversationId)) {
          queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
        }
        
        // Show notification if the message is not in active conversation
        if (activeConversation !== message.conversationId && !message.isFromAgent) {
          toast({
            title: "New Message",
            description: `From Customer #${message.conversationId}: "${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}"`,
          });
        }
      },
      onTyping: (typingIndicator) => {
        console.log("Typing indicator received:", typingIndicator);
        // Update customer typing status if it's for the currently active conversation
        if (activeConversation === typingIndicator.conversationId) {
          // The ChatWindow will handle this directly through its webSocketClient
        } else if (typingIndicator.isTyping) {
          // Show typing notification for non-active conversations
          toast({
            title: "Customer is typing...",
            description: `Customer in conversation #${typingIndicator.conversationId} is typing`,
            duration: 3000, // Short duration since typing notifications are transient
          });
        }
      },
      onStatusChange: (data) => {
        console.log("Status change received:", data);
        
        // Update the specific conversation
        if (data.conversationId) {
          // Update conversation status or details
          queryClient.invalidateQueries({ queryKey: [`/api/conversations/${data.conversationId}`] });
        }
        
        // Always refresh the conversations list to show new conversations, status changes, etc.
        queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
        
        // If this is about a conversation creation, show a notification
        if (!allConversations?.some(conv => conv.id === data.conversationId)) {
          toast({
            title: "New Conversation",
            description: `Customer conversation #${data.conversationId} has been created`,
          });
        }
      },
      onConnectionChange: (isConnected) => {
        setIsConnected(isConnected);
        if (!isConnected) {
          toast({
            title: "Connection Lost",
            description: "Reconnecting to server...",
            variant: "destructive",
          });
        } else if (isConnected) {
          toast({
            title: "Connected",
            description: "Successfully connected to server",
          });
        }
      }
    });
    
    client.connect();
    setWebSocketClient(client);
    
    return () => {
      client.disconnect();
    };
  }, [agentId, queryClient, toast, activeConversation, allConversations]);
  
  // Fetch all conversations
  const { data: allConversations, isLoading: isLoadingConversations } = useQuery<Conversation[]>({
    queryKey: ['/api/conversations'],
  });
  
  // Fetch messages for each conversation to get the last message
  const conversationsWithLastMessage = allConversations?.map(conversation => {
    const { data: messages } = useQuery<Message[]>({
      queryKey: [`/api/conversations/${conversation.id}/messages`],
      enabled: !!conversation.id,
    });
    
    const lastMessage = messages?.length ? messages[messages.length - 1] : undefined;
    const unreadCount = messages?.filter(msg => !msg.readStatus && !msg.isFromAgent).length || 0;
    
    return {
      ...conversation,
      lastMessage,
      unreadCount
    } as ConversationWithLastMessage;
  }) || [];
  
  // Handle selecting a conversation
  const handleSelectConversation = async (conversationId: number) => {
    setActiveConversation(conversationId);
    
    // On mobile, hide the conversation list when a conversation is selected
    if (isMobile) {
      setShowConversationList(false);
    }
    
    // Assign the conversation to this agent if not already assigned
    const conversation = allConversations?.find(c => c.id === conversationId);
    if (conversation && (!conversation.agentId || conversation.agentId !== agentId)) {
      try {
        await fetch(`/api/conversations/${conversationId}/assign`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId }),
        });
        
        // Update the conversations cache
        queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      } catch (error) {
        console.error('Error assigning conversation:', error);
      }
    }
  };
  
  // Handle back button on mobile
  const handleBackToList = () => {
    setShowConversationList(true);
  };
  
  return (
    <div className="flex flex-col h-screen">
      <Header agentName="John Smith" isOnline={isConnected} onLogout={onLogout} unreadCount={conversationsWithLastMessage.reduce((acc, conv) => acc + conv.unreadCount, 0)} />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Conversation List */}
        {(!isMobile || showConversationList) && (
          <div className={`${isMobile ? 'w-full' : 'w-80'} bg-white border-r border-neutral-medium flex-shrink-0`}>
            <ConversationList 
              conversations={conversationsWithLastMessage}
              activeConversationId={activeConversation}
              onSelectConversation={handleSelectConversation}
              isLoading={isLoadingConversations}
            />
          </div>
        )}
        
        {/* Chat Window */}
        {(!isMobile || !showConversationList) && (
          <div className="flex-grow">
            {activeConversation ? (
              <ChatWindow 
                conversationId={activeConversation}
                agentId={agentId}
                webSocketClient={webSocketClient}
                onBack={isMobile ? handleBackToList : undefined}
              />
            ) : (
              <div className="h-full flex items-center justify-center bg-neutral-light">
                <div className="text-center p-4">
                  <span className="material-icons text-6xl text-neutral-dark mb-4">chat</span>
                  <h2 className="text-xl font-medium text-neutral-dark">Select a conversation</h2>
                  <p className="text-neutral-dark mt-2">Choose a conversation from the list to start chatting</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
