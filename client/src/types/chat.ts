import { Conversation, Message, CannedResponse } from "@shared/schema";

export type ConversationWithLastMessage = Conversation & {
  lastMessage?: Message;
  unreadCount: number;
};

export type ClientMessage = {
  id: number;
  content: string;
  isFromAgent: boolean;
  timestamp: Date;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'error';
};

export type TypingIndicator = {
  conversationId: number;
  isTyping: boolean;
};

export interface WebSocketEvents {
  onMessage: (message: Message) => void;
  onTyping: (typingIndicator: TypingIndicator) => void;
  onStatusChange: (data: { conversationId: number; status: string; agentId?: number }) => void;
  onReadReceipt: (data: { messageId: number }) => void;
  onConnectionChange: (isConnected: boolean) => void;
}
