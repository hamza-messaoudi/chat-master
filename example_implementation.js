/**
 * Example Implementation: External Chat Client
 * 
 * This example demonstrates how to implement a custom chat client
 * that integrates with the agent API using both REST and WebSocket.
 */

class ExternalChatClient {
  constructor(config) {
    // Required configuration
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://your-agent-api-domain.com';
    this.customerId = config.customerId || `customer-${this.generateRandomId()}`;
    
    // Optional configuration
    this.customerName = config.customerName || '';
    this.customerEmail = config.customerEmail || '';
    this.customerBirthdate = config.customerBirthdate || null;
    
    // Internal state
    this.conversationId = null;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimeout = 1000; // ms
    this.messageQueue = [];
    this.isConnected = false;
    
    // Callbacks
    this.onMessageReceived = config.onMessageReceived || function() {};
    this.onTypingChanged = config.onTypingChanged || function() {};
    this.onStatusChanged = config.onStatusChanged || function() {};
    this.onConnectionChanged = config.onConnectionChanged || function() {};
    this.onFlashbackReceived = config.onFlashbackReceived || function() {};
    this.onError = config.onError || console.error;
    
    // If customer data is provided, update the customer record
    if (this.customerName || this.customerEmail || this.customerBirthdate) {
      this.updateCustomerData();
    }
  }
  
  /**
   * Generate a random ID for the customer
   */
  generateRandomId() {
    return Math.random().toString(36).substring(2, 10);
  }
  
  /**
   * Initialize the chat client
   */
  async initialize() {
    try {
      // Find or create a conversation for this customer
      const conversations = await this.fetchConversations();
      
      if (conversations && conversations.length > 0) {
        // Use the most recent conversation
        this.conversationId = conversations[0].id;
        
        // Notify status change
        this.onStatusChanged({
          status: conversations[0].status,
          agentId: conversations[0].agentId
        });
      } else {
        // Create a new conversation
        await this.createConversation();
      }
      
      // Connect to WebSocket for real-time updates
      this.connectWebSocket();
      
      return true;
    } catch (error) {
      this.onError('Failed to initialize chat client:', error);
      return false;
    }
  }
  
  /**
   * Make an authenticated API request
   */
  async apiRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`
    };
    
    const fetchOptions = {
      method: options.method || 'GET',
      headers,
      ...options
    };
    
    try {
      const response = await fetch(url, fetchOptions);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      this.onError(`API request to ${endpoint} failed:`, error);
      throw error;
    }
  }
  
  /**
   * Fetch conversations for the customer
   */
  async fetchConversations() {
    return this.apiRequest(`/api/partner/conversations/${this.customerId}`);
  }
  
  /**
   * Create a new conversation
   */
  async createConversation() {
    const conversation = await this.apiRequest('/api/partner/conversations', {
      method: 'POST',
      body: JSON.stringify({
        customerId: this.customerId
      })
    });
    
    this.conversationId = conversation.id;
    return conversation;
  }
  
  /**
   * Update customer data
   */
  async updateCustomerData() {
    const data = {};
    
    if (this.customerName) data.name = this.customerName;
    if (this.customerEmail) data.email = this.customerEmail;
    if (this.customerBirthdate) data.birthdate = this.customerBirthdate;
    
    return this.apiRequest(`/api/customers/${this.customerId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }
  
  /**
   * Fetch messages for a conversation
   */
  async fetchMessages() {
    if (!this.conversationId) {
      throw new Error('No active conversation');
    }
    
    return this.apiRequest(`/api/partner/messages/${this.conversationId}`);
  }
  
  /**
   * Send a message
   */
  async sendMessage(text, metadata = null) {
    if (!text.trim()) return;
    
    // Create a conversation if doesn't exist yet
    if (!this.conversationId) {
      await this.createConversation();
    }
    
    const messageData = {
      conversationId: this.conversationId,
      senderId: this.customerId,
      isFromAgent: false,
      content: text
    };
    
    // Add metadata if provided
    if (metadata) {
      messageData.metadata = metadata;
    }
    
    // If WebSocket is connected, send through WebSocket
    if (this.isConnected && this.ws) {
      this.ws.send(JSON.stringify({
        type: 'message',
        payload: messageData
      }));
      return;
    }
    
    // Otherwise use REST API
    try {
      return await this.apiRequest('/api/partner/messages', {
        method: 'POST',
        body: JSON.stringify(messageData)
      });
    } catch (error) {
      this.onError('Failed to send message:', error);
      throw error;
    }
  }
  
  /**
   * Send typing indicator
   */
  sendTypingIndicator(isTyping) {
    if (!this.conversationId) return;
    
    // Only send via WebSocket
    if (this.isConnected && this.ws) {
      this.ws.send(JSON.stringify({
        type: 'typing',
        payload: {
          conversationId: this.conversationId,
          isTyping,
          isAgent: false
        }
      }));
    }
  }
  
  /**
   * Connect to WebSocket
   */
  connectWebSocket() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${new URL(this.baseUrl).host}/ws?clientId=${this.customerId}`;
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.onConnectionChanged(true);
      
      // Send any queued messages
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        this.ws.send(JSON.stringify(message));
      }
    };
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'message':
            this.onMessageReceived(data.payload);
            break;
          case 'typing':
            this.onTypingChanged(data.payload);
            break;
          case 'status':
            this.onStatusChanged(data.payload);
            break;
          case 'flashback':
            this.onFlashbackReceived(data.payload);
            break;
          default:
            console.log('Unknown WebSocket message type:', data.type);
        }
      } catch (error) {
        this.onError('Error processing WebSocket message:', error);
      }
    };
    
    this.ws.onclose = () => {
      this.isConnected = false;
      this.onConnectionChanged(false);
      
      // Attempt to reconnect
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = this.reconnectTimeout * Math.pow(2, this.reconnectAttempts - 1);
        
        setTimeout(() => {
          this.connectWebSocket();
        }, delay);
      }
    };
    
    this.ws.onerror = (error) => {
      this.onError('WebSocket error:', error);
    };
  }
  
  /**
   * Disconnect WebSocket
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Example usage:
// 
// const chatClient = new ExternalChatClient({
//   apiKey: 'your-api-key',
//   baseUrl: 'https://your-agent-api-domain.com',
//   customerId: 'customer-123456',
//   customerName: 'John Doe',
//   customerEmail: 'john@example.com',
//   customerBirthdate: '1990-01-15',
//   onMessageReceived: (message) => {
//     console.log('New message:', message);
//     // Update UI with new message
//   },
//   onTypingChanged: (data) => {
//     console.log('Typing status changed:', data);
//     // Show/hide typing indicator
//   },
//   onStatusChanged: (data) => {
//     console.log('Conversation status changed:', data);
//     // Update UI with new status
//   },
//   onConnectionChanged: (isConnected) => {
//     console.log('Connection status:', isConnected ? 'connected' : 'disconnected');
//     // Update UI with connection status
//   },
//   onFlashbackReceived: (data) => {
//     console.log('Flashback profile received:', data);
//     // Display customer personality insights
//   }
// });
// 
// // Initialize the chat client
// chatClient.initialize().then(() => {
//   console.log('Chat client initialized');
// });
// 
// // Send a message
// chatClient.sendMessage('Hello, I need help with my order');
// 
// // Send a message with metadata
// chatClient.sendMessage('My order number is ORD-12345', {
//   commandType: 'order_lookup',
//   value: 'ORD-12345'
// });
// 
// // Send typing indicator
// chatClient.sendTypingIndicator(true);
// 
// // Clear typing indicator
// chatClient.sendTypingIndicator(false);