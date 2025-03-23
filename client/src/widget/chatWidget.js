/**
 * Customer Support Chat Widget
 * 
 * A lightweight widget that can be embedded into partner websites to provide
 * customer support chat functionality.
 * 
 * Usage:
 * 1. Include this script in your website
 * 2. Initialize the widget with your API key:
 *    ChatWidget.init({ apiKey: 'your-api-key' });
 */

class ChatWidget {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || window.location.origin;
    this.customerId = config.customerId || `customer-${this.generateId()}`;
    this.conversationId = null;
    this.socket = null;
    this.messages = [];
    this.container = null;
    this.chatWindow = null;
    this.isOpen = false;
    this.unreadCount = 0;
  }

  /**
   * Initialize the chat widget
   * @param {Object} config Configuration options
   */
  static init(config) {
    if (!config.apiKey) {
      console.error('ChatWidget: API key is required');
      return;
    }

    const widget = new ChatWidget(config);
    widget.render();
    return widget;
  }

  /**
   * Generate a random ID for the customer
   */
  generateId() {
    return Math.random().toString(36).substring(2, 10);
  }

  /**
   * Create and inject the widget HTML into the page
   */
  render() {
    // Create container
    this.container = document.createElement('div');
    this.container.className = 'chat-widget-container';
    this.container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      font-family: Arial, sans-serif;
    `;

    // Create toggle button
    const toggleButton = document.createElement('div');
    toggleButton.className = 'chat-widget-toggle';
    toggleButton.style.cssText = `
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #3a7bd5, #00d2ff);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      transition: all 0.3s ease;
    `;
    toggleButton.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    `;
    toggleButton.addEventListener('click', () => this.toggleChat());

    // Create unread badge
    this.unreadBadge = document.createElement('div');
    this.unreadBadge.className = 'chat-widget-unread';
    this.unreadBadge.style.cssText = `
      position: absolute;
      top: -5px;
      right: -5px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background-color: #ff4757;
      color: white;
      font-size: 12px;
      display: flex;
      justify-content: center;
      align-items: center;
      display: none;
    `;
    toggleButton.appendChild(this.unreadBadge);

    // Create chat window
    this.chatWindow = document.createElement('div');
    this.chatWindow.className = 'chat-widget-window';
    this.chatWindow.style.cssText = `
      position: absolute;
      bottom: 70px;
      right: 0;
      width: 320px;
      height: 400px;
      background-color: white;
      border-radius: 10px;
      box-shadow: 0 5px 20px rgba(0, 0, 0, 0.15);
      overflow: hidden;
      display: none;
      flex-direction: column;
    `;

    // Create header
    const header = document.createElement('div');
    header.className = 'chat-widget-header';
    header.style.cssText = `
      background: linear-gradient(135deg, #3a7bd5, #00d2ff);
      color: white;
      padding: 15px;
      font-weight: bold;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    header.innerHTML = `
      <div>Customer Support</div>
      <div class="chat-widget-close" style="cursor: pointer;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </div>
    `;
    header.querySelector('.chat-widget-close').addEventListener('click', () => this.toggleChat());

    // Create messages container
    this.messagesContainer = document.createElement('div');
    this.messagesContainer.className = 'chat-widget-messages';
    this.messagesContainer.style.cssText = `
      flex: 1;
      padding: 15px;
      overflow-y: auto;
    `;

    // Add welcome message
    const welcomeMsg = document.createElement('div');
    welcomeMsg.className = 'chat-widget-message chat-widget-message-agent';
    welcomeMsg.style.cssText = `
      background-color: #f1f1f1;
      color: #333;
      border-radius: 18px;
      padding: 10px 15px;
      margin-bottom: 10px;
      max-width: 80%;
      margin-left: auto;
      margin-right: 0;
    `;
    welcomeMsg.textContent = 'Hello! How can we help you today?';
    this.messagesContainer.appendChild(welcomeMsg);

    // Create input area
    const inputArea = document.createElement('div');
    inputArea.className = 'chat-widget-input';
    inputArea.style.cssText = `
      padding: 15px;
      border-top: 1px solid #eee;
      display: flex;
    `;
    
    const messageInput = document.createElement('input');
    messageInput.type = 'text';
    messageInput.placeholder = 'Type your message...';
    messageInput.style.cssText = `
      flex: 1;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 20px;
      outline: none;
    `;
    
    const sendButton = document.createElement('button');
    sendButton.style.cssText = `
      background: linear-gradient(135deg, #3a7bd5, #00d2ff);
      color: white;
      border: none;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      margin-left: 10px;
      cursor: pointer;
      display: flex;
      justify-content: center;
      align-items: center;
    `;
    sendButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
      </svg>
    `;
    
    sendButton.addEventListener('click', () => this.sendMessage(messageInput.value));
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage(messageInput.value);
      }
    });
    
    inputArea.appendChild(messageInput);
    inputArea.appendChild(sendButton);
    
    // Assemble the chat window
    this.chatWindow.appendChild(header);
    this.chatWindow.appendChild(this.messagesContainer);
    this.chatWindow.appendChild(inputArea);
    
    // Add elements to container
    this.container.appendChild(this.chatWindow);
    this.container.appendChild(toggleButton);
    
    // Add the container to the document
    document.body.appendChild(this.container);
    
    // Initialize the conversation and websocket connection
    this.initialize();
  }
  
  /**
   * Initialize the chat widget with API calls and websocket connection
   */
  async initialize() {
    try {
      // Find or create a conversation for this customer
      const conversations = await this.fetchConversations();
      
      if (conversations && conversations.length > 0) {
        // Use the most recent conversation
        this.conversationId = conversations[0].id;
        
        // Load messages for this conversation
        const messages = await this.fetchMessages(this.conversationId);
        if (messages && messages.length > 0) {
          this.displayMessages(messages);
        }
      } else {
        // Create a new conversation
        await this.createConversation();
      }
      
      // Connect to WebSocket for real-time updates
      this.connectWebSocket();
    } catch (error) {
      console.error('Failed to initialize chat widget:', error);
      this.displayErrorMessage('Could not connect to support service. Please try again later.');
    }
  }
  
  /**
   * Toggle the chat window visibility
   */
  toggleChat() {
    this.isOpen = !this.isOpen;
    this.chatWindow.style.display = this.isOpen ? 'flex' : 'none';
    
    if (this.isOpen) {
      // Reset unread count when opening the chat
      this.unreadCount = 0;
      this.updateUnreadBadge();
      // Scroll to the bottom of the messages
      this.scrollToBottom();
    }
  }
  
  /**
   * API request helper with authentication
   */
  async apiRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`
    };
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...(options.headers || {})
        }
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }
  
  /**
   * Fetch conversations for this customer
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
   * Fetch messages for a conversation
   */
  async fetchMessages(conversationId) {
    return this.apiRequest(`/api/partner/messages/${conversationId}`);
  }
  
  /**
   * Send a message
   */
  async sendMessage(text) {
    if (!text.trim()) return;
    
    // Clear the input field
    const input = this.chatWindow.querySelector('input');
    input.value = '';
    
    // Create a conversation if doesn't exist yet
    if (!this.conversationId) {
      await this.createConversation();
    }
    
    // Add message to UI immediately for better UX
    this.addMessageToUI(text, false);
    
    try {
      // Send to API
      await this.apiRequest('/api/partner/messages', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: this.conversationId,
          senderId: this.customerId,
          isFromAgent: false,
          content: text
        })
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      this.displayErrorMessage('Failed to send message. Please try again.');
    }
  }
  
  /**
   * Add a message to the UI
   */
  addMessageToUI(text, isFromAgent) {
    const message = document.createElement('div');
    message.className = `chat-widget-message ${isFromAgent ? 'chat-widget-message-agent' : 'chat-widget-message-customer'}`;
    message.style.cssText = `
      background-color: ${isFromAgent ? '#f1f1f1' : '#3a7bd5'};
      color: ${isFromAgent ? '#333' : 'white'};
      border-radius: 18px;
      padding: 10px 15px;
      margin-bottom: 10px;
      max-width: 80%;
      margin-left: ${isFromAgent ? '0' : 'auto'};
      margin-right: ${isFromAgent ? 'auto' : '0'};
    `;
    message.textContent = text;
    
    this.messagesContainer.appendChild(message);
    this.scrollToBottom();
    
    // Increment unread count if chat is closed and message is from agent
    if (!this.isOpen && isFromAgent) {
      this.unreadCount++;
      this.updateUnreadBadge();
    }
  }
  
  /**
   * Display an error message in the chat
   */
  displayErrorMessage(text) {
    const message = document.createElement('div');
    message.className = 'chat-widget-message chat-widget-message-error';
    message.style.cssText = `
      background-color: #ffebee;
      color: #d32f2f;
      border-radius: 18px;
      padding: 10px 15px;
      margin-bottom: 10px;
      text-align: center;
      font-size: 12px;
    `;
    message.textContent = text;
    
    this.messagesContainer.appendChild(message);
    this.scrollToBottom();
  }
  
  /**
   * Display multiple messages in the chat
   */
  displayMessages(messages) {
    // Clear existing messages except the welcome message
    const welcomeMessage = this.messagesContainer.firstChild;
    this.messagesContainer.innerHTML = '';
    this.messagesContainer.appendChild(welcomeMessage);
    
    // Display the messages
    messages.forEach(message => {
      this.addMessageToUI(message.content, message.isFromAgent);
    });
  }
  
  /**
   * Scroll to the bottom of the messages container
   */
  scrollToBottom() {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }
  
  /**
   * Update the unread badge
   */
  updateUnreadBadge() {
    if (this.unreadCount > 0) {
      this.unreadBadge.textContent = this.unreadCount > 9 ? '9+' : this.unreadCount;
      this.unreadBadge.style.display = 'flex';
    } else {
      this.unreadBadge.style.display = 'none';
    }
  }
  
  /**
   * Connect to WebSocket for real-time updates
   */
  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?clientId=${this.customerId}`;
    
    this.socket = new WebSocket(wsUrl);
    
    this.socket.onopen = () => {
      console.log('WebSocket connection established');
    };
    
    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'message' && data.payload.conversationId === this.conversationId) {
          // Only show messages for the current conversation
          if (data.payload.isFromAgent) {
            this.addMessageToUI(data.payload.content, true);
          }
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };
    
    this.socket.onclose = () => {
      console.log('WebSocket connection closed. Reconnecting in 3s...');
      setTimeout(() => this.connectWebSocket(), 3000);
    };
    
    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }
}

// Make available globally
window.ChatWidget = ChatWidget;

// Export for module usage
export default ChatWidget;