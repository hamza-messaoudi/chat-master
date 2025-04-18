import { pgTable, text, serial, integer, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isAgent: boolean("is_agent").default(false),
  automationDelay: integer("automation_delay").default(3000), // Default 3-second delay for auto-responses
});

export const customers = pgTable("customers", {
  id: text("id").primaryKey(), // customer-xxxxxxxx format
  name: text("name"),
  email: text("email"),
  birthdate: date("birthdate"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  customerId: text("customer_id").notNull().references(() => customers.id),
  agentId: integer("agent_id").references(() => users.id),
  status: text("status").notNull().default("waiting"), // waiting, active, resolved
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => conversations.id),
  senderId: text("sender_id").notNull(), // userId or customerId
  isFromAgent: boolean("is_from_agent").notNull(),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  readStatus: boolean("read_status").default(false),
  metadata: text("metadata"), // JSON string for storing command metadata
});

export const cannedResponses = pgTable("canned_responses", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => users.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
});

export const llmPrompts = pgTable("llm_prompts", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => users.id),
  title: text("title").notNull(),
  prompt: text("prompt"),  // Making this optional, since we'll focus on systemPrompt
  systemPrompt: text("system_prompt").notNull(),  // Making this required
  category: text("category").default("general"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const partners = pgTable("partners", {
  id: text("id").primaryKey(),  // partner-xxxxxxxx format
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  apiKey: text("api_key").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  isAgent: true,
  automationDelay: true,
});

export const insertCustomerSchema = createInsertSchema(customers).pick({
  id: true,
  name: true,
  email: true,
  birthdate: true,
});

export const insertConversationSchema = createInsertSchema(conversations).pick({
  customerId: true,
  agentId: true,
  status: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  conversationId: true,
  senderId: true,
  isFromAgent: true,
  content: true,
}).extend({
  // Define metadata as a Record type to accept objects
  metadata: z.record(z.any()).nullish(),
  readStatus: z.boolean().optional()
});

export const insertCannedResponseSchema = createInsertSchema(cannedResponses).pick({
  agentId: true,
  title: true,
  content: true,
});

export const insertPartnerSchema = createInsertSchema(partners).pick({
  id: true,
  name: true,
  domain: true,
  apiKey: true,
});

export const insertLlmPromptSchema = createInsertSchema(llmPrompts).pick({
  agentId: true,
  title: true,
  category: true,
  systemPrompt: true,
}).extend({
  prompt: z.string().optional(),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

// MessageMetadata type for consistent typing
export interface MessageMetadata extends Record<string, any> {
  commandType?: string;
  value?: any;
}

export type Message = typeof messages.$inferSelect & {
  metadata?: MessageMetadata | null; // The parsed metadata object
};
export type InsertMessage = z.infer<typeof insertMessageSchema> & {
  metadata?: MessageMetadata | null; // Allow passing metadata object
};

export type CannedResponse = typeof cannedResponses.$inferSelect;
export type InsertCannedResponse = z.infer<typeof insertCannedResponseSchema>;

export type Partner = typeof partners.$inferSelect;
export type InsertPartner = z.infer<typeof insertPartnerSchema>;

export type LlmPrompt = typeof llmPrompts.$inferSelect;
export type InsertLlmPrompt = z.infer<typeof insertLlmPromptSchema>;

// WebSocket message types
export type WebSocketMessage = {
  type: 'message' | 'status' | 'typing' | 'read' | 'flashback';
  payload: any;
};

// Flashback profile types
export interface EventDate {
  month: string;
  year: number;
}

export interface FlashbackProfile {
  flashBack: {
    firstEventDate: EventDate;
    firstEventTrait: string;
    secondEventDate: EventDate;
    secondEventTrait: string;
  };
}
