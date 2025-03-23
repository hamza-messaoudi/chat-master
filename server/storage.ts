import { 
  users, type User, type InsertUser,
  conversations, type Conversation, type InsertConversation,
  messages, type Message, type InsertMessage,
  cannedResponses, type CannedResponse, type InsertCannedResponse
} from "@shared/schema";

// Storage interface
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Conversation methods
  getConversation(id: number): Promise<Conversation | undefined>;
  getConversationsByCustomerId(customerId: string): Promise<Conversation[]>;
  getConversationsByAgentId(agentId: number): Promise<Conversation[]>;
  getConversationsByStatus(status: string): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversationStatus(id: number, status: string): Promise<Conversation | undefined>;
  assignConversation(id: number, agentId: number): Promise<Conversation | undefined>;
  getAllActiveConversations(): Promise<Conversation[]>;
  
  // Message methods
  getMessage(id: number): Promise<Message | undefined>;
  getMessagesByConversationId(conversationId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageAsRead(id: number): Promise<Message | undefined>;
  
  // Canned responses methods
  getCannedResponse(id: number): Promise<CannedResponse | undefined>;
  getCannedResponsesByAgentId(agentId: number): Promise<CannedResponse[]>;
  createCannedResponse(cannedResponse: InsertCannedResponse): Promise<CannedResponse>;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private conversations: Map<number, Conversation>;
  private messages: Map<number, Message>;
  private cannedResponses: Map<number, CannedResponse>;
  
  private userId: number;
  private conversationId: number;
  private messageId: number;
  private cannedResponseId: number;
  
  constructor() {
    this.users = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    this.cannedResponses = new Map();
    
    this.userId = 1;
    this.conversationId = 1;
    this.messageId = 1;
    this.cannedResponseId = 1;
    
    // Add a default agent user
    this.createUser({
      username: "agent",
      password: "password", // In a real app, this would be hashed
      isAgent: true
    });
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const now = new Date();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // Conversation methods
  async getConversation(id: number): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }
  
  async getConversationsByCustomerId(customerId: string): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).filter(
      (conversation) => conversation.customerId === customerId,
    );
  }
  
  async getConversationsByAgentId(agentId: number): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).filter(
      (conversation) => conversation.agentId === agentId,
    );
  }
  
  async getConversationsByStatus(status: string): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).filter(
      (conversation) => conversation.status === status,
    );
  }
  
  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const id = this.conversationId++;
    const now = new Date();
    const conversation: Conversation = {
      ...insertConversation,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.conversations.set(id, conversation);
    return conversation;
  }
  
  async updateConversationStatus(id: number, status: string): Promise<Conversation | undefined> {
    const conversation = this.conversations.get(id);
    if (!conversation) return undefined;
    
    const updatedConversation: Conversation = {
      ...conversation,
      status,
      updatedAt: new Date()
    };
    this.conversations.set(id, updatedConversation);
    return updatedConversation;
  }
  
  async assignConversation(id: number, agentId: number): Promise<Conversation | undefined> {
    const conversation = this.conversations.get(id);
    if (!conversation) return undefined;
    
    const updatedConversation: Conversation = {
      ...conversation,
      agentId,
      status: "active",
      updatedAt: new Date()
    };
    this.conversations.set(id, updatedConversation);
    return updatedConversation;
  }
  
  async getAllActiveConversations(): Promise<Conversation[]> {
    return Array.from(this.conversations.values());
  }
  
  // Message methods
  async getMessage(id: number): Promise<Message | undefined> {
    return this.messages.get(id);
  }
  
  async getMessagesByConversationId(conversationId: number): Promise<Message[]> {
    return Array.from(this.messages.values()).filter(
      (message) => message.conversationId === conversationId,
    );
  }
  
  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = this.messageId++;
    const now = new Date();
    const message: Message = {
      ...insertMessage,
      id,
      timestamp: now,
      readStatus: false
    };
    this.messages.set(id, message);
    
    // Update the conversation's updatedAt timestamp
    const conversation = this.conversations.get(message.conversationId);
    if (conversation) {
      this.conversations.set(conversation.id, {
        ...conversation,
        updatedAt: now
      });
    }
    
    return message;
  }
  
  async markMessageAsRead(id: number): Promise<Message | undefined> {
    const message = this.messages.get(id);
    if (!message) return undefined;
    
    const updatedMessage: Message = {
      ...message,
      readStatus: true
    };
    this.messages.set(id, updatedMessage);
    return updatedMessage;
  }
  
  // Canned responses methods
  async getCannedResponse(id: number): Promise<CannedResponse | undefined> {
    return this.cannedResponses.get(id);
  }
  
  async getCannedResponsesByAgentId(agentId: number): Promise<CannedResponse[]> {
    return Array.from(this.cannedResponses.values()).filter(
      (response) => response.agentId === agentId,
    );
  }
  
  async createCannedResponse(insertCannedResponse: InsertCannedResponse): Promise<CannedResponse> {
    const id = this.cannedResponseId++;
    const cannedResponse: CannedResponse = {
      ...insertCannedResponse,
      id
    };
    this.cannedResponses.set(id, cannedResponse);
    return cannedResponse;
  }
}

export const storage = new MemStorage();
