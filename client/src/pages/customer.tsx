import { useState, useEffect } from "react";
import { useParams } from "wouter";
import CustomerChat from "@/components/customer/CustomerChat";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { v4 as uuidv4 } from "uuid";

export default function CustomerPage() {
  const { conversationId } = useParams();
  const [customerId, setCustomerId] = useState<string>("");
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(
    conversationId ? parseInt(conversationId) : null
  );
  const { toast } = useToast();
  
  useEffect(() => {
    // Get or create a customer ID for this session
    const existingCustomerId = sessionStorage.getItem("customerId");
    
    if (existingCustomerId) {
      setCustomerId(existingCustomerId);
    } else {
      // Generate a random ID for anonymous customer
      const newCustomerId = `customer-${uuidv4()}`;
      sessionStorage.setItem("customerId", newCustomerId);
      setCustomerId(newCustomerId);
    }
  }, []);
  
  useEffect(() => {
    if (customerId && !currentConversationId) {
      // Start a new conversation if we don't have one
      const createConversation = async () => {
        try {
          const response = await apiRequest("POST", "/api/conversations", {
            customerId,
            status: "waiting"
          });
          
          const conversation = await response.json();
          setCurrentConversationId(conversation.id);
          
          toast({
            title: "Chat Started",
            description: "A support agent will be with you shortly.",
          });
        } catch (error) {
          console.error("Error creating conversation:", error);
          toast({
            title: "Error",
            description: "Failed to start a conversation. Please try again.",
            variant: "destructive",
          });
        }
      };
      
      createConversation();
    }
  }, [customerId, currentConversationId, toast]);
  
  if (!customerId || !currentConversationId) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-light">
        <div className="text-center p-4">
          <span className="material-icons text-4xl animate-spin text-primary">refresh</span>
          <p className="mt-4 text-neutral-dark">Initializing chat...</p>
        </div>
      </div>
    );
  }
  
  return (
    <CustomerChat 
      customerId={customerId} 
      conversationId={currentConversationId} 
    />
  );
}
