import { 
  users, type User, type InsertUser,
  conversations, type Conversation, type InsertConversation,
  messages, type Message, type InsertMessage,
  cannedResponses, type CannedResponse, type InsertCannedResponse,
  partners, type Partner, type InsertPartner,
  llmPrompts, type LlmPrompt, type InsertLlmPrompt
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
  
  // LLM prompts methods
  getLlmPrompt(id: number): Promise<LlmPrompt | undefined>;
  getLlmPromptsByAgentId(agentId: number): Promise<LlmPrompt[]>;
  getLlmPromptsByCategory(category: string): Promise<LlmPrompt[]>;
  createLlmPrompt(llmPrompt: InsertLlmPrompt): Promise<LlmPrompt>;
  
  // Partner methods
  getPartner(id: string): Promise<Partner | undefined>;
  getPartnerByApiKey(apiKey: string): Promise<Partner | undefined>;
  createPartner(partner: InsertPartner): Promise<Partner>;
  getAllPartners(): Promise<Partner[]>;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private conversations: Map<number, Conversation>;
  private messages: Map<number, Message>;
  private cannedResponses: Map<number, CannedResponse>;
  private llmPrompts: Map<number, LlmPrompt>;
  private partners: Map<string, Partner>;
  
  private userId: number;
  private conversationId: number;
  private messageId: number;
  private cannedResponseId: number;
  private llmPromptId: number;
  
  constructor() {
    this.users = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    this.cannedResponses = new Map();
    this.llmPrompts = new Map();
    this.partners = new Map();
    
    this.userId = 1;
    this.conversationId = 1;
    this.messageId = 1;
    this.cannedResponseId = 1;
    this.llmPromptId = 1;
    
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
    const user: User = { 
      ...insertUser, 
      id, 
      // Ensure isAgent is never undefined
      isAgent: insertUser.isAgent ?? false
    };
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
      id,
      customerId: insertConversation.customerId,
      status: insertConversation.status || "waiting",
      agentId: insertConversation.agentId || null,
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
      id,
      conversationId: insertMessage.conversationId || null,
      senderId: insertMessage.senderId,
      isFromAgent: insertMessage.isFromAgent,
      content: insertMessage.content,
      timestamp: now,
      readStatus: false
    };
    this.messages.set(id, message);
    
    // Update the conversation's updatedAt timestamp
    if (message.conversationId) {
      const conversation = this.conversations.get(message.conversationId);
      if (conversation) {
        this.conversations.set(conversation.id, {
          ...conversation,
          updatedAt: now
        });
      }
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
      id,
      title: insertCannedResponse.title,
      content: insertCannedResponse.content,
      agentId: insertCannedResponse.agentId || null
    };
    this.cannedResponses.set(id, cannedResponse);
    return cannedResponse;
  }

  // Partner methods
  async getPartner(id: string): Promise<Partner | undefined> {
    return this.partners.get(id);
  }

  async getPartnerByApiKey(apiKey: string): Promise<Partner | undefined> {
    return Array.from(this.partners.values()).find(
      (partner) => partner.apiKey === apiKey
    );
  }

  async createPartner(insertPartner: InsertPartner): Promise<Partner> {
    const now = new Date();
    const partner: Partner = {
      id: insertPartner.id,
      name: insertPartner.name,
      domain: insertPartner.domain,
      apiKey: insertPartner.apiKey,
      createdAt: now
    };
    this.partners.set(partner.id, partner);
    return partner;
  }

  async getAllPartners(): Promise<Partner[]> {
    return Array.from(this.partners.values());
  }
  
  // LLM prompts methods
  async getLlmPrompt(id: number): Promise<LlmPrompt | undefined> {
    return this.llmPrompts.get(id);
  }
  
  async getLlmPromptsByAgentId(agentId: number): Promise<LlmPrompt[]> {
    return Array.from(this.llmPrompts.values()).filter(
      (prompt) => prompt.agentId === agentId,
    );
  }
  
  async getLlmPromptsByCategory(category: string): Promise<LlmPrompt[]> {
    return Array.from(this.llmPrompts.values()).filter(
      (prompt) => prompt.category === category,
    );
  }
  
  async createLlmPrompt(insertLlmPrompt: InsertLlmPrompt): Promise<LlmPrompt> {
    const id = this.llmPromptId++;
    const now = new Date();
    const llmPrompt: LlmPrompt = {
      id,
      title: insertLlmPrompt.title,
      prompt: insertLlmPrompt.prompt,
      category: insertLlmPrompt.category || 'general',
      agentId: insertLlmPrompt.agentId || null,
      createdAt: now
    };
    this.llmPrompts.set(id, llmPrompt);
    return llmPrompt;
  }
}

import { PostgresStorage } from './db-storage';

// Use PostgreSQL storage for production
export const storage = new PostgresStorage();
