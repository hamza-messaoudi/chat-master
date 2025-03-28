import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { z } from "zod";
import { 
  insertConversationSchema, 
  insertMessageSchema, 
  insertCannedResponseSchema,
  insertPartnerSchema,
  insertLlmPromptSchema,
  insertCustomerSchema,
  insertUserSchema,
  type WebSocketMessage
} from "@shared/schema";
import { partnerAuthMiddleware } from "./partners";
import { handleLlmRequest } from "./llm";
import { generateFlashbackProfile } from "./flashback";

// Store client connections - exported to be used in other modules
export const clients = new Map<string, WebSocket>();

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Set up WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws, req) => {
    const clientId = req.url?.split('clientId=')[1]?.split('&')[0] || '';
    clients.set(clientId, ws);
    
    console.log(`WebSocket client connected: ${clientId}`);
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString()) as WebSocketMessage;
        
        if (data.type === 'message') {
          const { conversationId, content, senderId, isFromAgent } = data.payload;
          
          // Save message to storage
          const newMessage = await storage.createMessage({
            conversationId,
            senderId,
            isFromAgent,
            content
          });
          
          // Get conversation to broadcast to right clients
          const conversation = await storage.getConversation(conversationId);
          
          if (conversation) {
            // Broadcast to the customer
            const customerWs = clients.get(conversation.customerId);
            if (customerWs && customerWs.readyState === WebSocket.OPEN) {
              customerWs.send(JSON.stringify({
                type: 'message',
                payload: newMessage
              }));
            }
            
            // Broadcast to the agent if assigned
            if (conversation.agentId) {
              const agentWs = clients.get(`agent-${conversation.agentId}`);
              if (agentWs && agentWs.readyState === WebSocket.OPEN) {
                agentWs.send(JSON.stringify({
                  type: 'message',
                  payload: newMessage
                }));
              }
            }
            
            // Broadcast to all agents if not assigned to anyone
            if (!conversation.agentId || conversation.status === 'waiting') {
              // Send to all agent websockets
              Array.from(clients.entries()).forEach(([id, clientWs]) => {
                if (id.startsWith('agent-') && clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({
                    type: 'message',
                    payload: newMessage
                  }));
                }
              });
            }
            
            // If message is from customer, automatically generate an LLM response
            if (!isFromAgent) {
              // Get the default LLM prompt for the conversation's agent immediately
              // even though we may not send until later - this way we can prepare the
              // response in the background
              (async () => {
                try {
                  // Get all LLM prompts for this agent
                  const agentId = conversation.agentId || 1; // Default to agent 1 if not assigned
                  const llmPrompts = await storage.getLlmPromptsByAgentId(agentId);
                  
                  // Get all messages from the conversation for context
                  const messages = await storage.getMessagesByConversationId(conversationId);
                  
                  let systemPrompt: string | undefined;
                  
                  if (llmPrompts && llmPrompts.length > 0) {
                    // Use the first prompt as default
                    systemPrompt = llmPrompts[0].systemPrompt || undefined;
                  }
                  
                  // Generate the LLM response
                  const { handleLlmRequest } = await import('./llm');
                  
                  // Create a mock request and response to use the existing handler
                  const mockReq = {
                    body: {
                      conversationId,
                      autoSend: true,
                      ...(systemPrompt && { customPrompt: systemPrompt })
                    }
                  } as Request;
                  
                  const mockRes = {
                    status: (code: number) => ({
                      json: (data: any) => {
                        console.log(`Auto LLM response for conversation ${conversationId} sent with status ${code}`);
                      }
                    })
                  } as unknown as Response;
                  
                  // Send response immediately - the client will handle the display
                  // timing based on the agent's automation delay settings
                  await handleLlmRequest(mockReq, mockRes);
                } catch (error) {
                  console.error(`Error auto-generating LLM response for conversation ${conversationId}:`, error);
                }
              })();
            }
          }
        } else if (data.type === 'typing') {
          const { conversationId, isTyping, isAgent } = data.payload;
          
          // Get conversation to broadcast typing status
          const conversation = await storage.getConversation(conversationId);
          
          if (conversation) {
            if (isAgent) {
              // Send typing indicator to customer
              const customerWs = clients.get(conversation.customerId);
              if (customerWs && customerWs.readyState === WebSocket.OPEN) {
                customerWs.send(JSON.stringify({
                  type: 'typing',
                  payload: { conversationId, isTyping }
                }));
              }
            } else {
              // Send typing indicator to agent
              if (conversation.agentId) {
                const agentWs = clients.get(`agent-${conversation.agentId}`);
                if (agentWs && agentWs.readyState === WebSocket.OPEN) {
                  agentWs.send(JSON.stringify({
                    type: 'typing',
                    payload: { conversationId, isTyping }
                  }));
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    ws.on('close', () => {
      clients.delete(clientId);
      console.log(`WebSocket client disconnected: ${clientId}`);
    });
  });
  
  // API Routes
  // 1. Customer conversation routes
  app.post('/api/conversations', async (req: Request, res: Response) => {
    try {
      const validateData = insertConversationSchema.safeParse(req.body);
      
      if (!validateData.success) {
        return res.status(400).json({ error: validateData.error });
      }
      
      const { customerId } = validateData.data;
      
      // Check if customer exists, create if not
      const existingCustomer = await storage.getCustomer(customerId);
      if (!existingCustomer) {
        console.log(`Customer ${customerId} not found. Creating new customer record.`);
        await storage.createCustomer({
          id: customerId,
          // Only create with ID, other fields can be updated later
        });
      }
      
      const conversation = await storage.createConversation(validateData.data);
      return res.status(201).json(conversation);
    } catch (error) {
      console.error('Error creating conversation:', error);
      return res.status(500).json({ error: 'Failed to create conversation' });
    }
  });
  
  app.get('/api/conversations/customer/:customerId', async (req: Request, res: Response) => {
    try {
      const { customerId } = req.params;
      const conversations = await storage.getConversationsByCustomerId(customerId);
      return res.json(conversations);
    } catch (error) {
      console.error('Error fetching customer conversations:', error);
      return res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  });
  
  // 2. Agent conversation routes
  app.get('/api/conversations', async (req: Request, res: Response) => {
    try {
      const conversations = await storage.getAllActiveConversations();
      console.log('Fetched conversations:', JSON.stringify(conversations));
      return res.json(conversations);
    } catch (error) {
      console.error('Error fetching all conversations:', error);
      return res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  });
  
  // Important: Order matters! More specific routes must be defined before the generic ones
  app.get('/api/conversations/status/:status', async (req: Request, res: Response) => {
    try {
      const { status } = req.params;
      const conversations = await storage.getConversationsByStatus(status);
      return res.json(conversations);
    } catch (error) {
      console.error('Error fetching conversations by status:', error);
      return res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  });
  
  // This generic route must come after more specific routes that start with /api/conversations/
  app.get('/api/conversations/:id([0-9]+)', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const conversation = await storage.getConversation(Number(id));
      
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      
      return res.json(conversation);
    } catch (error) {
      console.error('Error fetching conversation:', error);
      return res.status(500).json({ error: 'Failed to fetch conversation' });
    }
  });
  
  app.patch('/api/conversations/:id/status', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      const validStatus = z.enum(['waiting', 'active', 'resolved']).safeParse(status);
      if (!validStatus.success) {
        return res.status(400).json({ error: 'Invalid status value' });
      }
      
      const conversation = await storage.updateConversationStatus(Number(id), status);
      
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      
      // Broadcast status change to relevant clients
      Array.from(clients.entries()).forEach(([clientId, ws]) => {
        if ((clientId === conversation.customerId || 
            (clientId.startsWith('agent-') && (clientId === `agent-${conversation.agentId}` || conversation.status === 'waiting'))) && 
            ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'status',
            payload: { conversationId: conversation.id, status: conversation.status }
          }));
        }
      });
      
      return res.json(conversation);
    } catch (error) {
      console.error('Error updating conversation status:', error);
      return res.status(500).json({ error: 'Failed to update conversation status' });
    }
  });
  
  app.patch('/api/conversations/:id/assign', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { agentId } = req.body;
      
      const conversation = await storage.assignConversation(Number(id), Number(agentId));
      
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      
      // Broadcast assignment to relevant clients
      Array.from(clients.entries()).forEach(([clientId, ws]) => {
        if ((clientId === conversation.customerId || clientId.startsWith('agent-')) && 
            ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'status',
            payload: { 
              conversationId: conversation.id, 
              status: conversation.status,
              agentId: conversation.agentId
            }
          }));
        }
      });
      
      return res.json(conversation);
    } catch (error) {
      console.error('Error assigning conversation:', error);
      return res.status(500).json({ error: 'Failed to assign conversation' });
    }
  });
  
  // 3. Message routes
  app.get('/api/conversations/:conversationId/messages', async (req: Request, res: Response) => {
    try {
      const { conversationId } = req.params;
      const messages = await storage.getMessagesByConversationId(Number(conversationId));
      return res.json(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });
  
  app.post('/api/messages', async (req: Request, res: Response) => {
    try {
      // Create a properly shaped message object with metadata properly formatted
      const messageData = {
        ...req.body,
        // Ensure metadata is in the correct format
        metadata: req.body.metadata ? 
          (typeof req.body.metadata === 'string' ? 
            JSON.parse(req.body.metadata) : 
            req.body.metadata
          ) : null
      };
      
      // Validate the data
      const validateData = insertMessageSchema.safeParse(messageData);
      
      if (!validateData.success) {
        return res.status(400).json({ error: validateData.error });
      }
      
      // Store the message
      const message = await storage.createMessage(validateData.data);
      return res.status(201).json(message);
    } catch (error) {
      console.error('Error creating message:', error);
      return res.status(500).json({ error: 'Failed to create message' });
    }
  });
  
  app.patch('/api/messages/:id/read', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const message = await storage.markMessageAsRead(Number(id));
      
      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }
      
      // Broadcast read status to sender if conversation exists
      if (message.conversationId) {
        const conversation = await storage.getConversation(message.conversationId);
        
        if (conversation) {
          // If agent read customer's message, notify customer
          if (message.isFromAgent === false) {
            const customerWs = clients.get(conversation.customerId);
            if (customerWs && customerWs.readyState === WebSocket.OPEN) {
              customerWs.send(JSON.stringify({
                type: 'read',
                payload: { messageId: message.id }
              }));
            }
          } 
          // If customer read agent's message, notify agent
          else if (conversation.agentId) {
            const agentWs = clients.get(`agent-${conversation.agentId}`);
            if (agentWs && agentWs.readyState === WebSocket.OPEN) {
              agentWs.send(JSON.stringify({
                type: 'read',
                payload: { messageId: message.id }
              }));
            }
          }
        }
      }
      
      return res.json(message);
    } catch (error) {
      console.error('Error marking message as read:', error);
      return res.status(500).json({ error: 'Failed to mark message as read' });
    }
  });
  
  // 4. Canned responses routes
  app.get('/api/canned-responses/:agentId', async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const responses = await storage.getCannedResponsesByAgentId(Number(agentId));
      return res.json(responses);
    } catch (error) {
      console.error('Error fetching canned responses:', error);
      return res.status(500).json({ error: 'Failed to fetch canned responses' });
    }
  });
  
  app.post('/api/canned-responses', async (req: Request, res: Response) => {
    try {
      const validateData = insertCannedResponseSchema.safeParse(req.body);
      
      if (!validateData.success) {
        return res.status(400).json({ error: validateData.error });
      }
      
      const cannedResponse = await storage.createCannedResponse(validateData.data);
      return res.status(201).json(cannedResponse);
    } catch (error) {
      console.error('Error creating canned response:', error);
      return res.status(500).json({ error: 'Failed to create canned response' });
    }
  });

  // 5. Partner routes
  // Partner API for integration - these routes require API key authentication
  app.post('/api/partner/register', async (req: Request, res: Response) => {
    try {
      // This is an admin-only endpoint for registering new partners
      const { name, domain } = req.body;
      
      if (!name || !domain) {
        return res.status(400).json({ error: 'Partner name and domain are required' });
      }
      
      // Import createPartner dynamically to avoid circular dependencies
      const { createPartner } = await import('./partners');
      
      const partner = await createPartner(name, domain);
      return res.status(201).json({
        message: 'Partner successfully registered',
        partnerId: partner.partnerId,
        apiKey: partner.apiKey,
        name: partner.name,
        domain: partner.domain
      });
    } catch (error) {
      console.error('Error registering partner:', error);
      return res.status(500).json({ error: 'Failed to register partner' });
    }
  });
  
  // Routes requiring API key authentication
  app.post('/api/partner/conversations', partnerAuthMiddleware, async (req: Request, res: Response) => {
    try {
      const { customerId } = req.body;
      
      if (!customerId) {
        return res.status(400).json({ error: 'Customer ID is required' });
      }
      
      // Check if customer exists, create if not
      const existingCustomer = await storage.getCustomer(customerId);
      if (!existingCustomer) {
        console.log(`Customer ${customerId} not found. Creating new customer record.`);
        await storage.createCustomer({
          id: customerId,
          // Only create with ID, other fields can be updated later
        });
      }
      
      const conversation = await storage.createConversation({
        customerId,
        status: 'waiting'
      });
      
      return res.status(201).json(conversation);
    } catch (error) {
      console.error('Error creating partner conversation:', error);
      return res.status(500).json({ error: 'Failed to create conversation' });
    }
  });
  
  app.get('/api/partner/conversations/:customerId', partnerAuthMiddleware, async (req: Request, res: Response) => {
    try {
      const { customerId } = req.params;
      const conversations = await storage.getConversationsByCustomerId(customerId);
      return res.json(conversations);
    } catch (error) {
      console.error('Error fetching partner conversations:', error);
      return res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  });
  
  app.post('/api/partner/messages', partnerAuthMiddleware, async (req: Request, res: Response) => {
    try {
      const { conversationId, content, senderId, isFromAgent, metadata } = req.body;
      
      if (!conversationId || !content || !senderId) {
        return res.status(400).json({ error: 'Conversation ID, content and sender ID are required' });
      }
      
      // Process metadata if provided
      const processedMetadata = metadata ? 
        (typeof metadata === 'string' ? JSON.parse(metadata) : metadata) : 
        null;
      
      const message = await storage.createMessage({
        conversationId,
        senderId,
        isFromAgent: isFromAgent || false,
        content,
        metadata: processedMetadata
      });
      
      return res.status(201).json(message);
    } catch (error) {
      console.error('Error creating partner message:', error);
      return res.status(500).json({ error: 'Failed to create message' });
    }
  });
  
  app.get('/api/partner/messages/:conversationId', partnerAuthMiddleware, async (req: Request, res: Response) => {
    try {
      const { conversationId } = req.params;
      const messages = await storage.getMessagesByConversationId(Number(conversationId));
      return res.json(messages);
    } catch (error) {
      console.error('Error fetching partner messages:', error);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });
  
  // 6. LLM prompt routes
  app.get('/api/llm-prompts/:agentId', async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const prompts = await storage.getLlmPromptsByAgentId(Number(agentId));
      return res.json(prompts);
    } catch (error) {
      console.error('Error fetching LLM prompts:', error);
      return res.status(500).json({ error: 'Failed to fetch LLM prompts' });
    }
  });
  
  app.get('/api/llm-prompts/category/:category', async (req: Request, res: Response) => {
    try {
      const { category } = req.params;
      const prompts = await storage.getLlmPromptsByCategory(category);
      return res.json(prompts);
    } catch (error) {
      console.error('Error fetching LLM prompts by category:', error);
      return res.status(500).json({ error: 'Failed to fetch LLM prompts' });
    }
  });
  
  app.post('/api/llm-prompts', async (req: Request, res: Response) => {
    try {
      const validateData = insertLlmPromptSchema.safeParse(req.body);
      
      if (!validateData.success) {
        return res.status(400).json({ error: validateData.error });
      }
      
      const llmPrompt = await storage.createLlmPrompt(validateData.data);
      return res.status(201).json(llmPrompt);
    } catch (error) {
      console.error('Error creating LLM prompt:', error);
      return res.status(500).json({ error: 'Failed to create LLM prompt' });
    }
  });
  
  // 7. LLM generation route
  app.post('/api/llm/generate', handleLlmRequest);
  
  // 8. Customer management routes
  app.post('/api/customers', async (req: Request, res: Response) => {
    try {
      const validateData = insertCustomerSchema.safeParse(req.body);
      
      if (!validateData.success) {
        return res.status(400).json({ error: validateData.error });
      }
      
      const customer = await storage.createCustomer(validateData.data);
      return res.status(201).json(customer);
    } catch (error) {
      console.error('Error creating customer:', error);
      return res.status(500).json({ error: 'Failed to create customer' });
    }
  });

  app.get('/api/customers/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const customer = await storage.getCustomer(id);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      return res.json(customer);
    } catch (error) {
      console.error('Error fetching customer:', error);
      return res.status(500).json({ error: 'Failed to fetch customer' });
    }
  });

  app.patch('/api/customers/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const customer = await storage.updateCustomer(id, updateData);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      return res.json(customer);
    } catch (error) {
      console.error('Error updating customer:', error);
      return res.status(500).json({ error: 'Failed to update customer' });
    }
  });

  // 9. Flashback profile routes
  app.get('/api/customers/:id/flashback', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const customer = await storage.getCustomer(id);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      if (!customer.birthdate) {
        return res.status(400).json({ error: 'Customer birthdate not set' });
      }
      
      // Ensure we have a valid date string
      const birthdateString = typeof customer.birthdate === 'string' 
        ? customer.birthdate 
        : new Date(customer.birthdate).toISOString();
        
      const flashbackProfile = generateFlashbackProfile(birthdateString);
      
      // Send profile to customer via WebSocket if they're connected
      const customerWs = clients.get(id);
      if (customerWs && customerWs.readyState === WebSocket.OPEN) {
        customerWs.send(JSON.stringify({
          type: 'flashback',
          payload: flashbackProfile
        }));
      }
      
      return res.json(flashbackProfile);
    } catch (error) {
      console.error('Error generating flashback profile:', error);
      return res.status(500).json({ error: 'Failed to generate flashback profile' });
    }
  });

  // 7. User Settings Routes
  app.patch('/api/users/:id/automation-delay', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { automationDelay } = req.body;
      
      // Validate the delay value
      const automationDelaySchema = z.number().min(1).max(10);
      const validateData = automationDelaySchema.safeParse(automationDelay);
      
      if (!validateData.success) {
        return res.status(400).json({ error: 'Invalid automation delay value. Must be between 1 and 10 seconds.' });
      }
      
      // Update the user
      const user = await storage.updateUser(Number(id), { 
        automationDelay: automationDelay * 1000 // Convert to milliseconds for storage
      });
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      return res.json({ 
        id: user.id,
        automationDelay: user.automationDelay ? user.automationDelay / 1000 : 3 // Convert back to seconds for client
      });
    } catch (error) {
      console.error('Error updating user automation delay:', error);
      return res.status(500).json({ error: 'Failed to update automation delay' });
    }
  });
  
  return httpServer;
}
