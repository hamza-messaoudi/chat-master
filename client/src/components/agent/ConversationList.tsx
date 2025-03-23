import { useState } from "react";
import { ConversationWithLastMessage } from "@/types/chat";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";

interface ConversationListProps {
  conversations: ConversationWithLastMessage[];
  activeConversationId: number | null;
  onSelectConversation: (id: number) => void;
  isLoading: boolean;
}

export default function ConversationList({ 
  conversations, 
  activeConversationId, 
  onSelectConversation,
  isLoading
}: ConversationListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("active");
  
  // Filter conversations by status and search term
  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = !searchTerm || 
      (conv.lastMessage && conv.lastMessage.content.toLowerCase().includes(searchTerm.toLowerCase())) ||
      conv.customerId.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesTab = activeTab === "all" || conv.status === activeTab;
    
    return matchesSearch && matchesTab;
  });
  
  // Get counts by status
  const activeCount = conversations.filter(c => c.status === "active").length;
  const waitingCount = conversations.filter(c => c.status === "waiting").length;
  const resolvedCount = conversations.filter(c => c.status === "resolved").length;
  
  // Get conversation time display
  const getTimeDisplay = (conv: ConversationWithLastMessage) => {
    if (conv.lastMessage?.timestamp) {
      return formatDistanceToNow(new Date(conv.lastMessage.timestamp), { addSuffix: true });
    }
    // Ensure we have a valid date
    return formatDistanceToNow(conv.createdAt ? new Date(conv.createdAt) : new Date(), { addSuffix: true });
  };
  
  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <span className="inline-block px-2 py-1 text-xs rounded-full bg-success text-white">Active</span>;
      case "waiting":
        return <span className="inline-block px-2 py-1 text-xs rounded-full bg-neutral-dark text-white">Waiting</span>;
      case "resolved":
        return <span className="inline-block px-2 py-1 text-xs rounded-full bg-primary text-white">Resolved</span>;
      default:
        return <span className="inline-block px-2 py-1 text-xs rounded-full bg-warning text-white">In Progress</span>;
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-neutral-medium">
          <div className="animate-pulse h-10 bg-neutral-light rounded-lg"></div>
        </div>
        <div className="animate-pulse flex space-x-1 p-3 border-b border-neutral-medium">
          <div className="h-8 bg-neutral-light rounded flex-1"></div>
          <div className="h-8 bg-neutral-light rounded flex-1"></div>
          <div className="h-8 bg-neutral-light rounded flex-1"></div>
        </div>
        <div className="flex-grow overflow-y-auto">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="animate-pulse p-3 border-b border-neutral-medium">
              <div className="h-5 bg-neutral-light rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-neutral-light rounded w-full mb-2"></div>
              <div className="flex justify-between">
                <div className="h-6 bg-neutral-light rounded w-20"></div>
                <div className="h-4 bg-neutral-light rounded w-16"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b border-neutral-medium">
        <div className="relative">
          <span className="material-icons absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-dark text-sm sm:text-base">search</span>
          <Input
            type="text"
            placeholder="Search conversations..."
            className="w-full pl-9 pr-3 py-2 text-sm sm:text-base h-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      <Tabs defaultValue="active" className="flex-grow flex flex-col overflow-hidden" onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 border-b border-neutral-medium">
          <TabsTrigger value="active" className="py-2 text-xs sm:text-sm data-[state=active]:text-primary">
            Active ({activeCount})
          </TabsTrigger>
          <TabsTrigger value="waiting" className="py-2 text-xs sm:text-sm data-[state=active]:text-primary">
            Waiting ({waitingCount})
          </TabsTrigger>
          <TabsTrigger value="resolved" className="py-2 text-xs sm:text-sm data-[state=active]:text-primary">
            Resolved ({resolvedCount})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="flex-grow overflow-y-auto overflow-x-hidden custom-scrollbar m-0 p-0 h-0">
          <ConversationItems
            conversations={filteredConversations} 
            activeConversationId={activeConversationId}
            onSelectConversation={onSelectConversation}
            getTimeDisplay={getTimeDisplay}
            getStatusBadge={getStatusBadge}
          />
        </TabsContent>
        
        <TabsContent value="waiting" className="flex-grow overflow-y-auto overflow-x-hidden custom-scrollbar m-0 p-0 h-0">
          <ConversationItems
            conversations={filteredConversations} 
            activeConversationId={activeConversationId}
            onSelectConversation={onSelectConversation}
            getTimeDisplay={getTimeDisplay}
            getStatusBadge={getStatusBadge}
          />
        </TabsContent>
        
        <TabsContent value="resolved" className="flex-grow overflow-y-auto overflow-x-hidden custom-scrollbar m-0 p-0 h-0">
          <ConversationItems
            conversations={filteredConversations} 
            activeConversationId={activeConversationId}
            onSelectConversation={onSelectConversation}
            getTimeDisplay={getTimeDisplay}
            getStatusBadge={getStatusBadge}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface ConversationItemsProps {
  conversations: ConversationWithLastMessage[];
  activeConversationId: number | null;
  onSelectConversation: (id: number) => void;
  getTimeDisplay: (conv: ConversationWithLastMessage) => string;
  getStatusBadge: (status: string) => JSX.Element;
}

function ConversationItems({ 
  conversations, 
  activeConversationId, 
  onSelectConversation,
  getTimeDisplay,
  getStatusBadge
}: ConversationItemsProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-4 text-neutral-dark text-sm">
        <div className="text-center">
          <span className="material-icons block mx-auto mb-2 text-3xl">search_off</span>
          No conversations found
        </div>
      </div>
    );
  }
  
  return (
    <>
      {conversations.map(conversation => (
        <div 
          key={conversation.id}
          className={`conversation-item cursor-pointer hover:bg-neutral-light p-3 border-b border-neutral-medium transition-colors ${activeConversationId === conversation.id ? 'bg-blue-50' : ''}`}
          onClick={() => onSelectConversation(conversation.id)}
        >
          <div className="flex justify-between items-start">
            <div className="flex items-center">
              <div className="h-8 w-8 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-700 text-sm mr-2 flex-shrink-0">
                {conversation.customerId.slice(0, 2).toUpperCase()}
              </div>
              <span className="font-medium text-sm">
                Customer #{conversation.customerId.slice(0, 6)}
              </span>
            </div>
            <span className="text-xs text-neutral-dark ml-2">
              {conversation.lastMessage?.timestamp && typeof conversation.lastMessage.timestamp !== 'undefined' 
                ? new Date(conversation.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                : ''}
            </span>
          </div>
          
          <div className="pl-10">
            <p className="text-xs sm:text-sm text-neutral-dark truncate mt-1">
              {conversation.lastMessage ? conversation.lastMessage.content : 'New conversation'}
            </p>
            
            <div className="flex justify-between items-center mt-1">
              <div className="flex items-center space-x-2">
                {getStatusBadge(conversation.status)}
                <span className="text-xs text-neutral-dark">{getTimeDisplay(conversation)}</span>
              </div>
              
              {conversation.unreadCount > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-error rounded-full">
                  {conversation.unreadCount}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
