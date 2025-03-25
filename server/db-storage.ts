import { db } from './db';
import { IStorage } from './storage';
import { 
  User, InsertUser, 
  Customer, InsertCustomer,
  Conversation, InsertConversation, 
  Message, InsertMessage, 
  CannedResponse, InsertCannedResponse,
  Partner, InsertPartner,
  LlmPrompt, InsertLlmPrompt,
  users, customers, conversations, messages, cannedResponses, partners, llmPrompts
} from '../shared/schema';
import { eq, and, desc, asc } from 'drizzle-orm';

export class PostgresStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }
  
  // Customer methods
  async getCustomer(id: string): Promise<Customer | undefined> {
    const result = await db.select().from(customers).where(eq(customers.id, id));
    return result[0];
  }
  
  async getCustomerByEmail(email: string): Promise<Customer | undefined> {
    const result = await db.select().from(customers).where(eq(customers.email, email));
    return result[0];
  }
  
  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const result = await db.insert(customers).values(customer).returning();
    return result[0];
  }
  
  async updateCustomer(id: string, data: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const result = await db.update(customers)
      .set(data)
      .where(eq(customers.id, id))
      .returning();
    return result[0];
  }
  
  // Conversation methods
  async getConversation(id: number): Promise<Conversation | undefined> {
    const result = await db.select().from(conversations).where(eq(conversations.id, id));
    return result[0];
  }

  async getConversationsByCustomerId(customerId: string): Promise<Conversation[]> {
    return await db.select().from(conversations).where(eq(conversations.customerId, customerId));
  }

  async getConversationsByAgentId(agentId: number): Promise<Conversation[]> {
    return await db.select().from(conversations).where(eq(conversations.agentId, agentId));
  }

  async getConversationsByStatus(status: string): Promise<Conversation[]> {
    return await db.select().from(conversations).where(eq(conversations.status, status));
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const result = await db.insert(conversations).values(conversation).returning();
    return result[0];
  }

  async updateConversationStatus(id: number, status: string): Promise<Conversation | undefined> {
    const result = await db.update(conversations)
      .set({ status, updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning();
    return result[0];
  }

  async assignConversation(id: number, agentId: number): Promise<Conversation | undefined> {
    const result = await db.update(conversations)
      .set({ agentId, status: 'active', updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning();
    return result[0];
  }

  async getAllActiveConversations(): Promise<Conversation[]> {
    // Return all conversations for now, ordered by most recent first
    return await db.select().from(conversations)
      .orderBy(desc(conversations.updatedAt));
  }
  
  // Message methods
  async getMessage(id: number): Promise<Message | undefined> {
    const result = await db.select().from(messages).where(eq(messages.id, id));
    return result[0];
  }

  async getMessagesByConversationId(conversationId: number): Promise<Message[]> {
    return await db.select().from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.timestamp));
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    // When creating a message, update the conversation's updatedAt timestamp
    if (message.conversationId) {
      await db.update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, message.conversationId));
    }
    
    // If metadata exists but is an object, stringify it for storage
    const processedMessage = { ...message };
    if (processedMessage.metadata && typeof processedMessage.metadata === 'object') {
      processedMessage.metadata = JSON.stringify(processedMessage.metadata);
    }
    
    const result = await db.insert(messages).values(processedMessage).returning();
    
    // Parse metadata back to an object if it's a valid JSON string
    const returnedMessage = result[0];
    if (returnedMessage.metadata && typeof returnedMessage.metadata === 'string') {
      try {
        returnedMessage.metadata = JSON.parse(returnedMessage.metadata);
      } catch (e) {
        // If parsing fails, keep it as a string
      }
    }
    
    return returnedMessage;
  }

  async markMessageAsRead(id: number): Promise<Message | undefined> {
    const result = await db.update(messages)
      .set({ readStatus: true })
      .where(eq(messages.id, id))
      .returning();
    return result[0];
  }
  
  // Canned responses methods
  async getCannedResponse(id: number): Promise<CannedResponse | undefined> {
    const result = await db.select().from(cannedResponses).where(eq(cannedResponses.id, id));
    return result[0];
  }

  async getCannedResponsesByAgentId(agentId: number): Promise<CannedResponse[]> {
    return await db.select().from(cannedResponses).where(eq(cannedResponses.agentId, agentId));
  }

  async createCannedResponse(cannedResponse: InsertCannedResponse): Promise<CannedResponse> {
    const result = await db.insert(cannedResponses).values(cannedResponse).returning();
    return result[0];
  }

  // Partner methods
  async getPartner(id: string): Promise<Partner | undefined> {
    const result = await db.select().from(partners).where(eq(partners.id, id));
    return result[0];
  }

  async getPartnerByApiKey(apiKey: string): Promise<Partner | undefined> {
    const result = await db.select().from(partners).where(eq(partners.apiKey, apiKey));
    return result[0];
  }

  async createPartner(partner: InsertPartner): Promise<Partner> {
    const result = await db.insert(partners).values(partner).returning();
    return result[0];
  }

  async getAllPartners(): Promise<Partner[]> {
    return await db.select().from(partners);
  }
  
  // LLM prompts methods
  async getLlmPrompt(id: number): Promise<LlmPrompt | undefined> {
    const result = await db.select().from(llmPrompts).where(eq(llmPrompts.id, id));
    return result[0];
  }
  
  async getLlmPromptsByAgentId(agentId: number): Promise<LlmPrompt[]> {
    return await db.select().from(llmPrompts).where(eq(llmPrompts.agentId, agentId));
  }
  
  async getLlmPromptsByCategory(category: string): Promise<LlmPrompt[]> {
    return await db.select().from(llmPrompts).where(eq(llmPrompts.category, category));
  }
  
  async createLlmPrompt(llmPrompt: InsertLlmPrompt): Promise<LlmPrompt> {
    const result = await db.insert(llmPrompts).values(llmPrompt).returning();
    return result[0];
  }
}