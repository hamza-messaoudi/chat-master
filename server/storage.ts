import { 
  users, type User, type InsertUser,
  customers, type Customer, type InsertCustomer,
  conversations, type Conversation, type InsertConversation,
  messages, type Message, type InsertMessage, type MessageMetadata,
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
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  
  // Customer methods
  getCustomer(id: string): Promise<Customer | undefined>;
  getCustomerByEmail(email: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, data: Partial<InsertCustomer>): Promise<Customer | undefined>;
  
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
  private customers: Map<string, Customer>;
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
    this.customers = new Map();
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
      isAgent: insertUser.isAgent ?? false,
      // Ensure automationDelay is never undefined
      automationDelay: insertUser.automationDelay ?? 3000
    };
    this.users.set(id, user);
    return user;
  }
  
  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser: User = {
      ...user,
      ...data
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  // Customer methods
  async getCustomer(id: string): Promise<Customer | undefined> {
    return this.customers.get(id);
  }
  
  async getCustomerByEmail(email: string): Promise<Customer | undefined> {
    return Array.from(this.customers.values()).find(
      (customer) => customer.email === email,
    );
  }
  
  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const now = new Date();
    const customer: Customer = {
      id: insertCustomer.id,
      name: insertCustomer.name || null,
      email: insertCustomer.email || null,
      birthdate: insertCustomer.birthdate || null,
      createdAt: now
    };
    this.customers.set(customer.id, customer);
    return customer;
  }
  
  async updateCustomer(id: string, data: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const customer = this.customers.get(id);
    if (!customer) return undefined;
    
    const updatedCustomer: Customer = {
      ...customer,
      ...data
    };
    this.customers.set(id, updatedCustomer);
    return updatedCustomer;
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
    
    // Process metadata to ensure it's in the right format
    let processedMetadata: MessageMetadata | null = null;
    if (insertMessage.metadata) {
      if (typeof insertMessage.metadata === 'string') {
        try {
          processedMetadata = JSON.parse(insertMessage.metadata);
        } catch (e) {
          // If parsing fails, keep it as null
          console.error('Failed to parse metadata string:', e);
          processedMetadata = null;
        }
      } else {
        // If it's already an object, use it directly
        processedMetadata = insertMessage.metadata;
      }
    }
    
    // For the database, metadata must be either a string or null
    let metadataForStorage: string | null = null;
    if (processedMetadata) {
      metadataForStorage = JSON.stringify(processedMetadata);
    }
    
    const message: Message = {
      id,
      conversationId: insertMessage.conversationId || null,
      senderId: insertMessage.senderId,
      isFromAgent: insertMessage.isFromAgent,
      content: insertMessage.content,
      timestamp: now,
      readStatus: false,
      metadata: processedMetadata // Use parsed metadata object instead of the string
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
      prompt: insertLlmPrompt.prompt || null,
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
