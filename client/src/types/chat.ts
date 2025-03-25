import { Conversation, Message, CannedResponse, FlashbackProfile } from "@shared/schema";

export type ConversationWithLastMessage = Conversation & {
  lastMessage?: Message;
  unreadCount: number;
};

export type MessageMetadata = Record<string, any> & {
  commandType?: string;
  value?: any;
};

export type ClientMessage = {
  id: number;
  content: string;
  isFromAgent: boolean;
  timestamp: Date;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'error';
  metadata?: MessageMetadata | null; // For additional data like command types
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
  onFlashback: (data: FlashbackProfile) => void;
}
