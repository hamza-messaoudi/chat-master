import React, { useState, useEffect, useMemo } from "react";
import Header from "./Header";
import ConversationList from "./ConversationList";
import ChatWindow from "./ChatWindow";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import WebSocketClient from "@/lib/websocket";
import { ConversationWithLastMessage } from "@/types/chat";
import { Message, Conversation } from "@shared/schema";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNotifications } from "@/contexts/NotificationContext";

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
  const { addNotification } = useNotifications();
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
        
        // Update the conversation messages
        queryClient.invalidateQueries({ queryKey: ['conversation-messages'] });
        
        // Show notification if the message is not in active conversation
        if (activeConversation !== message.conversationId && !message.isFromAgent) {
          // Add to notifications system
          addNotification(
            "New Message",
            `From Customer #${message.conversationId}: "${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}"`,
            'message',
            { conversationId: message.conversationId, messageId: message.id }
          );
        }
      },
      onTyping: (typingIndicator) => {
        console.log("Typing indicator received:", typingIndicator);
        // Update customer typing status if it's for the currently active conversation
        if (activeConversation === typingIndicator.conversationId) {
          // The ChatWindow will handle this directly through its webSocketClient
        } else if (typingIndicator.isTyping) {
          // Show typing notification for non-active conversations
          addNotification(
            "Customer is typing...",
            `Customer in conversation #${typingIndicator.conversationId} is typing`,
            'status',
            { conversationId: typingIndicator.conversationId }
          );
        }
      },
      onStatusChange: (data) => {
        // Update conversation status
        queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
        queryClient.invalidateQueries({ queryKey: ['conversation-messages'] });
        
        // Notify about status changes
        addNotification(
          "Conversation Status Change",
          `Conversation #${data.conversationId} status changed to ${data.status}`,
          'status',
          data
        );
      },
      onConnectionChange: (isConnected) => {
        // Only update connection state without showing notifications
        setIsConnected(isConnected);
      }
    });
    
    client.connect();
    setWebSocketClient(client);
    
    return () => {
      client.disconnect();
    };
  }, [agentId, queryClient, toast, addNotification, activeConversation]);
  
  // Fetch all conversations
  const { data: allConversations, isLoading: isLoadingConversations } = useQuery<Conversation[]>({
    queryKey: ['/api/conversations'],
  });
  
  // Fetch all messages for each conversation separately
  const { data: lastMessages = [], isLoading: isLoadingMessages } = useQuery<Message[]>({
    queryKey: ['conversation-messages'],
    queryFn: async () => {
      if (!allConversations || allConversations.length === 0) return [];
      
      // Fetch the latest message for each conversation
      const messagePromises = allConversations.map(async conversation => {
        try {
          const response = await fetch(`/api/conversations/${conversation.id}/messages`);
          if (!response.ok) {
            console.error(`Failed to fetch messages for conversation ${conversation.id}`);
            return [];
          }
          const messages = await response.json();
          return messages; // Return all messages, we'll filter to the last one later
        } catch (error) {
          console.error(`Error fetching messages for conversation ${conversation.id}:`, error);
          return [];
        }
      });
      
      // Combine all messages
      const allMessagesArrays = await Promise.all(messagePromises);
      return allMessagesArrays.flat();
    },
    enabled: !!allConversations && allConversations.length > 0,
  });
  
  // Process conversations with last messages without using hooks in a map function
  const conversationsWithLastMessage = useMemo(() => {
    if (!allConversations) return [];
    
    return allConversations.map(conversation => {
      const conversationMessages = lastMessages.filter((m: Message) => m.conversationId === conversation.id);
      const lastMessage = conversationMessages.length > 0 
        ? conversationMessages[conversationMessages.length - 1] 
        : undefined;
      const unreadCount = conversationMessages.filter((msg: Message) => !msg.readStatus && !msg.isFromAgent).length || 0;
      
      return {
        ...conversation,
        lastMessage,
        unreadCount
      } as ConversationWithLastMessage;
    });
  }, [allConversations, lastMessages]);
  
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
        queryClient.invalidateQueries({ queryKey: ['conversation-messages'] });
      } catch (error) {
        console.error('Error assigning conversation:', error);
      }
    }
  };
  
  // Handle back button on mobile
  const handleBackToList = () => {
    setShowConversationList(true);
  };
  
  // Calculate total unread count across all conversations
  const totalUnreadCount = useMemo(() => {
    return conversationsWithLastMessage.reduce((acc, conv) => acc + conv.unreadCount, 0) || 0;
  }, [conversationsWithLastMessage]);

  return (
    <div className="flex flex-col h-screen w-full bg-neutral-50">
      <Header 
        agentName={`Agent ${agentId}`}
        isOnline={isConnected}
        unreadCount={totalUnreadCount}
        onLogout={onLogout} 
      />
      
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Conversation List - Full width on mobile, sidebar on larger screens */}
        {(!isMobile || showConversationList) && (
          <div className={`w-full md:w-80 bg-white border-r border-neutral-medium ${isMobile ? 'h-full' : 'h-auto'} flex-shrink-0 overflow-hidden`}>
            <div className="flex items-center justify-between p-3 md:hidden">
              <h2 className="font-medium text-lg">Conversations</h2>
            </div>
            <ConversationList 
              conversations={conversationsWithLastMessage}
              activeConversationId={activeConversation}
              onSelectConversation={handleSelectConversation}
              isLoading={isLoadingConversations}
            />
          </div>
        )}
        
        {/* Chat Window - Shown when conversation is selected on mobile */}
        {(!isMobile || !showConversationList) && (
          <div className="flex-grow h-full">
            {activeConversation ? (
              <ChatWindow 
                conversationId={activeConversation}
                agentId={agentId}
                webSocketClient={webSocketClient}
                onBack={isMobile ? handleBackToList : undefined}
              />
            ) : (
              <div className="h-full flex items-center justify-center bg-neutral-light p-4">
                <div className="text-center max-w-sm">
                  <span className="material-icons text-5xl sm:text-6xl text-neutral-dark mb-4">chat</span>
                  <h2 className="text-lg sm:text-xl font-medium text-neutral-dark">Select a conversation</h2>
                  <p className="text-neutral-dark mt-2 text-sm sm:text-base">Choose a conversation from the list to start chatting</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
