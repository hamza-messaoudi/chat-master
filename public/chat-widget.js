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
    this.customerId = config.customerId || this.getOrGenerateCustomerId();
    this.theme = config.theme || {
      primary: '#3a7bd5',
      secondary: '#00d2ff',
      textLight: '#ffffff',
      textDark: '#333333'
    };
    this.conversationId = null;
    this.socket = null;
    this.messages = [];
    this.container = null;
    this.chatWindow = null;
    this.messagesContainer = null;
    this.isOpen = false;
    this.unreadCount = 0;
    this.unreadBadge = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
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
   * Get existing customer ID from storage or generate a new one
   */
  getOrGenerateCustomerId() {
    const storedId = sessionStorage.getItem('chat_customer_id');
    if (storedId) {
      return storedId;
    }
    
    const newId = `customer-${this.generateId()}`;
    sessionStorage.setItem('chat_customer_id', newId);
    return newId;
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
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;

    // Insert CSS
    this.injectStyles();

    // Create toggle button
    const toggleButton = document.createElement('div');
    toggleButton.className = 'chat-widget-toggle';
    toggleButton.style.cssText = `
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, ${this.theme.primary}, ${this.theme.secondary});
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      transition: all 0.3s ease;
    `;
    toggleButton.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${this.theme.textLight}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
      transition: all 0.3s ease;
    `;

    // Create header
    const header = document.createElement('div');
    header.className = 'chat-widget-header';
    header.style.cssText = `
      background: linear-gradient(135deg, ${this.theme.primary}, ${this.theme.secondary});
      color: ${this.theme.textLight};
      padding: 15px;
      font-weight: bold;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    
    const headerLeft = document.createElement('div');
    headerLeft.className = 'chat-widget-header-left';
    headerLeft.innerHTML = `
      <div class="chat-widget-title">Customer Support</div>
    `;
    
    const headerRight = document.createElement('div');
    headerRight.className = 'chat-widget-header-right';
    headerRight.style.display = 'flex';
    headerRight.style.alignItems = 'center';
    
    // Connection status indicator
    this.connectionIndicator = document.createElement('div');
    this.connectionIndicator.className = 'chat-widget-connection-status';
    this.connectionIndicator.innerHTML = `
      <span class="chat-widget-status-dot"></span>
      <span class="chat-widget-status-text">Connecting...</span>
    `;
    this.connectionIndicator.style.cssText = `
      font-size: 11px;
      display: flex;
      align-items: center;
      margin-right: 10px;
    `;
    
    const statusDot = this.connectionIndicator.querySelector('.chat-widget-status-dot');
    statusDot.style.cssText = `
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: #ffcc00;
      margin-right: 5px;
    `;
    
    const closeButton = document.createElement('div');
    closeButton.className = 'chat-widget-close';
    closeButton.style.cssText = `
      cursor: pointer;
    `;
    closeButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${this.theme.textLight}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    closeButton.addEventListener('click', () => this.toggleChat());
    
    headerRight.appendChild(this.connectionIndicator);
    headerRight.appendChild(closeButton);
    
    header.appendChild(headerLeft);
    header.appendChild(headerRight);

    // Create messages container
    this.messagesContainer = document.createElement('div');
    this.messagesContainer.className = 'chat-widget-messages';
    this.messagesContainer.style.cssText = `
      flex: 1;
      padding: 15px;
      overflow-y: auto;
      background-color: #f8f9fa;
    `;

    // Add welcome message
    const welcomeMsg = document.createElement('div');
    welcomeMsg.className = 'chat-widget-message chat-widget-message-agent';
    welcomeMsg.textContent = 'Hello! How can we help you today?';
    this.messagesContainer.appendChild(welcomeMsg);

    // Create input area
    const inputArea = document.createElement('div');
    inputArea.className = 'chat-widget-input';
    inputArea.style.cssText = `
      padding: 10px 15px;
      border-top: 1px solid #eee;
      display: flex;
      background-color: white;
    `;
    
    const messageInput = document.createElement('textarea');
    messageInput.placeholder = 'Type your message...';
    messageInput.className = 'chat-widget-textarea';
    messageInput.style.cssText = `
      flex: 1;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 20px;
      resize: none;
      outline: none;
      max-height: 80px;
      min-height: 40px;
      font-family: inherit;
      font-size: 14px;
    `;
    
    const sendButton = document.createElement('button');
    sendButton.className = 'chat-widget-send';
    sendButton.style.cssText = `
      background: linear-gradient(135deg, ${this.theme.primary}, ${this.theme.secondary});
      color: white;
      border: none;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      margin-left: 10px;
      cursor: pointer;
      display: flex;
      justify-content: center;
      align-items: center;
      flex-shrink: 0;
    `;
    sendButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
      </svg>
    `;
    
    sendButton.addEventListener('click', () => this.sendMessage(messageInput.value));
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage(messageInput.value);
      }
    });
    
    // Auto resize textarea
    messageInput.addEventListener('input', () => {
      messageInput.style.height = 'auto';
      messageInput.style.height = Math.min(messageInput.scrollHeight, 80) + 'px';
    });
    
    inputArea.appendChild(messageInput);
    inputArea.appendChild(sendButton);
    
    // Footer with additional options
    const footer = document.createElement('div');
    footer.className = 'chat-widget-footer';
    footer.style.cssText = `
      display: flex;
      justify-content: space-between;
      padding: 5px 15px 10px;
      font-size: 11px;
      color: #666;
      background-color: white;
    `;
    
    const birthdateBtn = document.createElement('button');
    birthdateBtn.className = 'chat-widget-birthdate-btn';
    birthdateBtn.textContent = 'Add birthdate';
    birthdateBtn.style.cssText = `
      background: none;
      border: none;
      color: ${this.theme.primary};
      cursor: pointer;
      padding: 0;
      font-size: 11px;
      text-decoration: underline;
    `;
    birthdateBtn.addEventListener('click', () => this.showBirthdateForm());
    
    const endChatBtn = document.createElement('button');
    endChatBtn.className = 'chat-widget-end-chat';
    endChatBtn.textContent = 'End chat';
    endChatBtn.style.cssText = `
      background: none;
      border: none;
      color: #ff4757;
      cursor: pointer;
      padding: 0;
      font-size: 11px;
      text-decoration: underline;
    `;
    endChatBtn.addEventListener('click', () => this.endChat());
    
    footer.appendChild(birthdateBtn);
    footer.appendChild(endChatBtn);
    
    // Assemble the chat window
    this.chatWindow.appendChild(header);
    this.chatWindow.appendChild(this.messagesContainer);
    this.chatWindow.appendChild(inputArea);
    this.chatWindow.appendChild(footer);
    
    // Add elements to container
    this.container.appendChild(this.chatWindow);
    this.container.appendChild(toggleButton);
    
    // Add the container to the document
    document.body.appendChild(this.container);
    
    // Initialize the conversation and websocket connection
    this.initialize();
  }
  
  /**
   * Inject CSS styles into the page
   */
  injectStyles() {
    const styles = `
      .chat-widget-message {
        margin-bottom: 10px;
        max-width: 80%;
        padding: 10px 12px;
        border-radius: 18px;
        position: relative;
        word-wrap: break-word;
        line-height: 1.4;
        font-size: 14px;
      }
      
      .chat-widget-message-agent {
        background-color: white;
        color: ${this.theme.textDark};
        border: 1px solid #e0e0e0;
        margin-right: auto;
        border-bottom-left-radius: 5px;
      }
      
      .chat-widget-message-customer {
        background: linear-gradient(135deg, ${this.theme.primary}, ${this.theme.secondary});
        color: ${this.theme.textLight};
        margin-left: auto;
        border-bottom-right-radius: 5px;
      }
      
      .chat-widget-message-time {
        font-size: 10px;
        opacity: 0.7;
        margin-top: 4px;
        text-align: right;
      }
      
      .chat-widget-message-error {
        background-color: #ffebee;
        color: #d32f2f;
        text-align: center;
        margin: 0 auto 10px;
        font-size: 12px;
        border-radius: 12px;
      }
      
      .chat-widget-typing {
        display: flex;
        align-items: center;
        margin-bottom: 10px;
        background-color: white;
        border: 1px solid #e0e0e0;
        border-radius: 18px;
        padding: 10px 12px;
        width: fit-content;
        border-bottom-left-radius: 5px;
      }
      
      .chat-widget-typing-dot {
        width: 8px;
        height: 8px;
        background-color: #999;
        border-radius: 50%;
        margin: 0 2px;
        animation: typing-dot 1.4s infinite ease-in-out;
      }
      
      .chat-widget-typing-dot:nth-child(1) {
        animation-delay: 0s;
      }
      
      .chat-widget-typing-dot:nth-child(2) {
        animation-delay: 0.2s;
      }
      
      .chat-widget-typing-dot:nth-child(3) {
        animation-delay: 0.4s;
      }
      
      @keyframes typing-dot {
        0%, 60%, 100% {
          transform: translateY(0);
        }
        30% {
          transform: translateY(-5px);
        }
      }
      
      /* Birthdate form styles */
      .chat-widget-birthdate-form {
        background-color: white;
        border-bottom: 1px solid #eee;
        padding: 15px;
      }
      
      .chat-widget-birthdate-title {
        font-weight: bold;
        margin-bottom: 10px;
        font-size: 14px;
      }
      
      .chat-widget-birthdate-description {
        font-size: 12px;
        color: #666;
        margin-bottom: 10px;
      }
      
      .chat-widget-birthdate-input {
        width: 100%;
        padding: 8px 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        margin-bottom: 5px;
        font-size: 14px;
      }
      
      .chat-widget-birthdate-error {
        color: #d32f2f;
        font-size: 12px;
        margin-bottom: 10px;
      }
      
      .chat-widget-birthdate-buttons {
        display: flex;
        gap: 8px;
      }
      
      .chat-widget-birthdate-save {
        background: linear-gradient(135deg, ${this.theme.primary}, ${this.theme.secondary});
        color: white;
        border: none;
        border-radius: 4px;
        padding: 8px 12px;
        cursor: pointer;
        font-size: 12px;
        flex: 1;
      }
      
      .chat-widget-birthdate-cancel {
        background: #f1f1f1;
        color: #333;
        border: none;
        border-radius: 4px;
        padding: 8px 12px;
        cursor: pointer;
        font-size: 12px;
      }
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.type = 'text/css';
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);
  }
  
  /**
   * Initialize the chat widget with API calls and websocket connection
   */
  async initialize() {
    try {
      // Update connection status
      this.updateConnectionStatus('connecting');
      
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
      this.updateConnectionStatus('disconnected');
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
   * Update connection status indicator
   */
  updateConnectionStatus(status) {
    if (!this.connectionIndicator) return;
    
    const statusDot = this.connectionIndicator.querySelector('.chat-widget-status-dot');
    const statusText = this.connectionIndicator.querySelector('.chat-widget-status-text');
    
    switch (status) {
      case 'connected':
        statusDot.style.backgroundColor = '#4CAF50';
        statusText.textContent = 'Connected';
        this.isConnected = true;
        break;
      case 'connecting':
        statusDot.style.backgroundColor = '#FFEB3B';
        statusText.textContent = 'Connecting...';
        this.isConnected = false;
        break;
      case 'disconnected':
        statusDot.style.backgroundColor = '#F44336';
        statusText.textContent = 'Disconnected';
        this.isConnected = false;
        break;
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
    const input = this.chatWindow.querySelector('.chat-widget-textarea');
    input.value = '';
    input.style.height = 'auto';
    
    // Create a conversation if doesn't exist yet
    if (!this.conversationId) {
      await this.createConversation();
    }
    
    // Check for command pattern ($command) to add metadata
    let metadata = null;
    const commandRegex = /\$(\w+)(?:\s+(.+))?/;
    const match = text.match(commandRegex);
    
    if (match) {
      const [fullMatch, command, value] = match;
      metadata = {
        commandType: command,
        value: value || true
      };
      
      // Handle special commands
      if (command === 'dob' && value) {
        try {
          // Basic validation for date format
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            metadata.value = value;
          }
        } catch (e) {
          console.error("Invalid date format:", e);
        }
      }
    }
    
    // Add message to UI immediately for better UX
    this.addMessageToUI(text, false, metadata);
    
    try {
      // Send to API
      await this.apiRequest('/api/partner/messages', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: this.conversationId,
          senderId: this.customerId,
          isFromAgent: false,
          content: text,
          metadata: metadata ? JSON.stringify(metadata) : null
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
  addMessageToUI(text, isFromAgent, metadata = null) {
    const message = document.createElement('div');
    message.className = `chat-widget-message ${isFromAgent ? 'chat-widget-message-agent' : 'chat-widget-message-customer'}`;
    
    // Add text content
    const contentElement = document.createElement('div');
    contentElement.className = 'chat-widget-message-content';
    contentElement.textContent = text;
    message.appendChild(contentElement);
    
    // Add metadata if available
    if (metadata) {
      const metadataElement = document.createElement('div');
      metadataElement.className = 'chat-widget-message-metadata';
      metadataElement.style.cssText = `
        font-size: 10px;
        opacity: 0.8;
        margin-top: 4px;
        padding-top: 4px;
        border-top: 1px solid ${isFromAgent ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.3)'};
      `;
      
      if (metadata.commandType) {
        const commandElement = document.createElement('div');
        commandElement.className = 'chat-widget-message-command';
        commandElement.style.display = 'flex';
        commandElement.style.alignItems = 'center';
        
        let commandText = `Command: ${metadata.commandType}`;
        
        if (metadata.value && metadata.value !== true) {
          commandText += typeof metadata.value === 'string' 
            ? ` (${metadata.value})` 
            : ` (${JSON.stringify(metadata.value)})`;
        }
        
        commandElement.textContent = commandText;
        metadataElement.appendChild(commandElement);
      }
      
      message.appendChild(metadataElement);
    }
    
    // Add timestamp
    const timeElement = document.createElement('div');
    timeElement.className = 'chat-widget-message-time';
    timeElement.textContent = this.formatTime(new Date());
    message.appendChild(timeElement);
    
    this.messagesContainer.appendChild(message);
    this.scrollToBottom();
    
    // Increment unread count if chat is closed and message is from agent
    if (!this.isOpen && isFromAgent) {
      this.unreadCount++;
      this.updateUnreadBadge();
    }
  }
  
  /**
   * Show agent typing indicator
   */
  showTypingIndicator() {
    // Remove existing typing indicator if there is one
    this.removeTypingIndicator();
    
    // Add new typing indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'chat-widget-typing';
    typingIndicator.innerHTML = `
      <div class="chat-widget-typing-dot"></div>
      <div class="chat-widget-typing-dot"></div>
      <div class="chat-widget-typing-dot"></div>
    `;
    
    this.messagesContainer.appendChild(typingIndicator);
    this.scrollToBottom();
  }
  
  /**
   * Remove typing indicator
   */
  removeTypingIndicator() {
    const existingIndicator = this.messagesContainer.querySelector('.chat-widget-typing');
    if (existingIndicator) {
      this.messagesContainer.removeChild(existingIndicator);
    }
  }
  
  /**
   * Display an error message in the chat
   */
  displayErrorMessage(text) {
    const message = document.createElement('div');
    message.className = 'chat-widget-message-error';
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
      const msgElement = document.createElement('div');
      msgElement.className = `chat-widget-message ${message.isFromAgent ? 'chat-widget-message-agent' : 'chat-widget-message-customer'}`;
      
      // Add text content
      const contentElement = document.createElement('div');
      contentElement.className = 'chat-widget-message-content';
      contentElement.textContent = message.content;
      msgElement.appendChild(contentElement);
      
      // Parse and display metadata if available
      if (message.metadata) {
        let metadataObj;
        try {
          // Try to parse metadata if it's a string
          metadataObj = typeof message.metadata === 'string' 
            ? JSON.parse(message.metadata)
            : message.metadata;
          
          if (metadataObj && metadataObj.commandType) {
            const metadataElement = document.createElement('div');
            metadataElement.className = 'chat-widget-message-metadata';
            metadataElement.style.cssText = `
              font-size: 10px;
              opacity: 0.8;
              margin-top: 4px;
              padding-top: 4px;
              border-top: 1px solid ${message.isFromAgent ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.3)'};
            `;
            
            const commandElement = document.createElement('div');
            commandElement.className = 'chat-widget-message-command';
            commandElement.style.display = 'flex';
            commandElement.style.alignItems = 'center';
            
            let commandText = `Command: ${metadataObj.commandType}`;
            
            if (metadataObj.value && metadataObj.value !== true) {
              commandText += typeof metadataObj.value === 'string' 
                ? ` (${metadataObj.value})` 
                : ` (${JSON.stringify(metadataObj.value)})`;
            }
            
            commandElement.textContent = commandText;
            metadataElement.appendChild(commandElement);
            msgElement.appendChild(metadataElement);
          }
        } catch (e) {
          console.error('Error parsing metadata:', e);
        }
      }
      
      // Add timestamp
      const timeElement = document.createElement('div');
      timeElement.className = 'chat-widget-message-time';
      timeElement.textContent = this.formatTime(message.timestamp);
      msgElement.appendChild(timeElement);
      
      this.messagesContainer.appendChild(msgElement);
    });
    
    this.scrollToBottom();
  }
  
  /**
   * Format time for display
   */
  formatTime(timestamp) {
    if (!timestamp) return "--:--";
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
    try {
      if (this.socket) {
        this.socket.close();
      }
      
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${new URL(this.baseUrl).host}/ws?clientId=${this.customerId}`;
      
      this.socket = new WebSocket(wsUrl);
      
      this.socket.onopen = () => {
        console.log('WebSocket connection established');
        this.updateConnectionStatus('connected');
        this.reconnectAttempts = 0;
      };
      
      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'message':
              if (data.payload.conversationId === this.conversationId) {
                // Only show messages for the current conversation
                if (data.payload.isFromAgent) {
                  // Parse metadata if present
                  let metadata = null;
                  if (data.payload.metadata) {
                    try {
                      metadata = typeof data.payload.metadata === 'string'
                        ? JSON.parse(data.payload.metadata)
                        : data.payload.metadata;
                    } catch (e) {
                      console.error('Error parsing message metadata:', e);
                    }
                  }
                  this.addMessageToUI(data.payload.content, true, metadata);
                }
              }
              break;
              
            case 'typing':
              if (data.payload.conversationId === this.conversationId && 
                  data.payload.isTyping && data.payload.isAgent) {
                this.showTypingIndicator();
              } else if (data.payload.conversationId === this.conversationId && 
                  !data.payload.isTyping && data.payload.isAgent) {
                this.removeTypingIndicator();
              }
              break;
              
            case 'flashback':
              // User would need to add their birthdate first
              console.log('Received flashback profile:', data.payload);
              break;
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };
      
      this.socket.onclose = () => {
        this.updateConnectionStatus('disconnected');
        
        // Try to reconnect with exponential backoff
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = Math.pow(2, this.reconnectAttempts) * 1000;
          console.log(`WebSocket connection closed. Reconnecting in ${delay}ms...`);
          
          setTimeout(() => {
            this.reconnectAttempts++;
            this.updateConnectionStatus('connecting');
            this.connectWebSocket();
          }, delay);
        } else {
          console.log('Max reconnect attempts reached. Giving up.');
          this.displayErrorMessage('Connection lost. Please refresh the page to reconnect.');
        }
      };
      
      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.updateConnectionStatus('disconnected');
      };
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      this.updateConnectionStatus('disconnected');
    }
  }
  
  /**
   * Show the birthdate form
   */
  showBirthdateForm() {
    // Remove existing form if any
    const existingForm = this.chatWindow.querySelector('.chat-widget-birthdate-form');
    if (existingForm) {
      existingForm.remove();
    }
    
    // Create form container
    const formContainer = document.createElement('div');
    formContainer.className = 'chat-widget-birthdate-form';
    
    formContainer.innerHTML = `
      <div class="chat-widget-birthdate-title">Enter Your Birthdate</div>
      <div class="chat-widget-birthdate-description">
        Entering your birthdate will provide personalized insights in our conversation.
      </div>
      <input type="date" class="chat-widget-birthdate-input" placeholder="YYYY-MM-DD">
      <div class="chat-widget-birthdate-error" style="display: none;"></div>
      <div class="chat-widget-birthdate-buttons">
        <button class="chat-widget-birthdate-save">Save</button>
        <button class="chat-widget-birthdate-cancel">Cancel</button>
      </div>
    `;
    
    // Insert after header
    const header = this.chatWindow.querySelector('.chat-widget-header');
    header.insertAdjacentElement('afterend', formContainer);
    
    // Handle form interactions
    const input = formContainer.querySelector('.chat-widget-birthdate-input');
    const errorElement = formContainer.querySelector('.chat-widget-birthdate-error');
    const saveButton = formContainer.querySelector('.chat-widget-birthdate-save');
    const cancelButton = formContainer.querySelector('.chat-widget-birthdate-cancel');
    
    // Validate birthdate
    const validateBirthdate = (date) => {
      const parsedDate = new Date(date);
      
      // Check if date is valid
      if (isNaN(parsedDate.getTime())) {
        errorElement.textContent = "Please enter a valid date";
        errorElement.style.display = 'block';
        return false;
      }
      
      // Check if date is not in the future
      if (parsedDate > new Date()) {
        errorElement.textContent = "Birthdate cannot be in the future";
        errorElement.style.display = 'block';
        return false;
      }
      
      // Check if person is not too old (e.g., more than 120 years)
      const maxAge = new Date();
      maxAge.setFullYear(maxAge.getFullYear() - 120);
      if (parsedDate < maxAge) {
        errorElement.textContent = "Birthdate seems too far in the past";
        errorElement.style.display = 'block';
        return false;
      }
      
      return true;
    };
    
    // Update customer birthdate
    const updateBirthdate = async () => {
      const birthdate = input.value;
      
      if (!validateBirthdate(birthdate)) {
        return;
      }
      
      // Disable the save button and show loading state
      saveButton.disabled = true;
      saveButton.textContent = 'Saving...';
      
      try {
        // Update the customer profile via API
        await this.apiRequest(`/api/customers/${this.customerId}`, {
          method: 'PATCH',
          body: JSON.stringify({ birthdate })
        });
        
        // Show success message
        this.displayErrorMessage('Birthdate saved successfully!');
        
        // Remove form
        formContainer.remove();
      } catch (error) {
        console.error('Error updating birthdate:', error);
        errorElement.textContent = 'Failed to update birthdate. Please try again.';
        errorElement.style.display = 'block';
      } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Save';
      }
    };
    
    // Event listeners
    input.addEventListener('change', () => {
      errorElement.style.display = 'none';
    });
    
    saveButton.addEventListener('click', updateBirthdate);
    cancelButton.addEventListener('click', () => formContainer.remove());
  }
  
  /**
   * End the current chat session
   */
  async endChat() {
    if (!this.conversationId) return;
    
    try {
      await this.apiRequest(`/api/conversations/${this.conversationId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'resolved' })
      });
      
      // Display end message
      this.displayErrorMessage('Chat ended. Thank you for using our support chat!');
      
      // Create a new conversation
      const newConv = await this.createConversation();
      this.conversationId = newConv.id;
      
      // Clear messages except welcome message
      const welcomeMessage = this.messagesContainer.firstChild;
      this.messagesContainer.innerHTML = '';
      this.messagesContainer.appendChild(welcomeMessage);
    } catch (error) {
      console.error('Error ending chat:', error);
      this.displayErrorMessage('Failed to end chat. Please try again.');
    }
  }
}

// Make available globally
window.ChatWidget = ChatWidget;

// Support common module systems
if (typeof exports !== 'undefined') {
  exports.ChatWidget = ChatWidget;
}
if (typeof module !== 'undefined') {
  module.exports = ChatWidget;
}