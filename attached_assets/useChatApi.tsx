'use client';

import { useState, useCallback } from 'react';

interface SendMessageParams {
  conversationId: string;
  content: string;
  senderId: string;
  isFromAgent: boolean;
}

interface CustomerDataParams {
  customerId: string;
  email?: string;
  name?: string;
  birthdate?: string;
}

export function useChatApi() {
  const [isLoading, setIsLoading] = useState(false);
  
  // API call to get or create a conversation for a customer
  const getConversation = useCallback(async (customerId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/chat/conversations/${customerId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get conversation: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting conversation:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // API call to get messages for a conversation
  const getMessages = useCallback(async (conversationId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/chat/messages/${conversationId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get messages: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting messages:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // API call to send a message
  const sendMessage = useCallback(async (params: SendMessageParams) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // API call to update customer data
  const updateCustomerData = useCallback(async (params: CustomerDataParams) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/chat/customers/${params.customerId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update customer data: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error updating customer data:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  return {
    isLoading,
    getConversation,
    getMessages,
    sendMessage,
    updateCustomerData,
  };
}

export default useChatApi; 