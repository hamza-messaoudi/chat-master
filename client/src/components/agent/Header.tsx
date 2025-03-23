import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import NotificationsMenu from "./NotificationsMenu";
import { useNotifications } from "../../contexts/NotificationContext";

interface HeaderProps {
  agentName?: string;
  isOnline?: boolean;
  unreadCount?: number;
  onLogout: () => void;
}

export default function Header({ agentName = "Agent", isOnline = true, unreadCount = 0, onLogout }: HeaderProps) {
  const { notifications } = useNotifications();
  
  return (
    <header className="bg-white shadow-md">
      <div className="flex justify-between items-center px-4 py-2 h-16">
        <div className="flex items-center">
          <div className="flex items-center">
            <div className="relative">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-primary font-semibold">{agentName.charAt(0)}</span>
              </div>
              <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-neutral-400'}`}></div>
            </div>
            <div className="ml-3">
              <p className="font-medium text-sm">{agentName}</p>
              <p className="text-xs text-neutral-dark">
                {isOnline ? 'Online' : 'Offline'}
              </p>
            </div>
          </div>
          
          {unreadCount > 0 && (
            <Badge variant="destructive" className="ml-4">
              {unreadCount} Unread
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <NotificationsMenu />
          
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onLogout}
          >
            <span className="material-icons text-sm mr-1">logout</span>
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
