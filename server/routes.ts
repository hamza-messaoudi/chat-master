import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { PostgresStorage } from "./db-storage";
import { z } from "zod";
import { 
  insertConversationSchema, 
  insertMessageSchema, 
  insertCannedResponseSchema,
  type WebSocketMessage
} from "@shared/schema";

// Use database storage
const storage = new PostgresStorage();

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Set up WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store client connections
  const clients = new Map<string, WebSocket>();
  
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
              for (const [id, clientWs] of clients.entries()) {
                if (id.startsWith('agent-') && clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({
                    type: 'message',
                    payload: newMessage
                  }));
                }
              }
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
      return res.json(conversations);
    } catch (error) {
      console.error('Error fetching all conversations:', error);
      return res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  });
  
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
      for (const [clientId, ws] of clients.entries()) {
        if ((clientId === conversation.customerId || 
            (clientId.startsWith('agent-') && (clientId === `agent-${conversation.agentId}` || conversation.status === 'waiting'))) && 
            ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'status',
            payload: { conversationId: conversation.id, status: conversation.status }
          }));
        }
      }
      
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
      for (const [clientId, ws] of clients.entries()) {
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
      }
      
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
      const validateData = insertMessageSchema.safeParse(req.body);
      
      if (!validateData.success) {
        return res.status(400).json({ error: validateData.error });
      }
      
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
      
      // Broadcast read status to sender
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
  
  return httpServer;
}
