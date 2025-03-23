import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Message } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { useNotifications } from "@/contexts/NotificationContext";

export interface Notification {
  id: string;
  title: string;
  description: string;
  type: 'message' | 'status' | 'system';
  timestamp: Date;
  read: boolean;
  data?: any;
}

interface NotificationsMenuProps {
  onNotificationClick?: (notification: Notification) => void;
}

export default function NotificationsMenu({ onNotificationClick }: NotificationsMenuProps) {
  const { notifications, markAsRead, markAllAsRead, clearNotifications } = useNotifications();
  
  // Calculate unread count
  const unreadCount = notifications.filter((n: Notification) => !n.read).length;

  // Handle notification click
  const handleClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative h-8 w-8 rounded-full">
          <span className="material-icons text-sm">notifications</span>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-xs text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between p-2">
          <DropdownMenuLabel className="text-sm">Notifications</DropdownMenuLabel>
          <div className="flex gap-1">
            {notifications.some((n: Notification) => !n.read) && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllAsRead}>
                Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearNotifications}>
                Clear all
              </Button>
            )}
          </div>
        </div>
        <DropdownMenuSeparator />
        
        <div className="max-h-80 overflow-y-auto">
          {notifications.length > 0 ? (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`p-3 cursor-pointer ${notification.read ? '' : 'bg-neutral-50'}`}
                onClick={() => handleClick(notification)}
              >
                <div className="flex flex-col w-full">
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-xs">{notification.title}</span>
                    <span className="text-xs text-neutral-dark">
                      {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-dark mt-1 line-clamp-2">{notification.description}</p>
                </div>
              </DropdownMenuItem>
            ))
          ) : (
            <div className="p-4 text-center text-neutral-dark text-xs">No notifications</div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Export a context provider for sharing notifications across components
export function createNotification(
  title: string,
  description: string,
  type: 'message' | 'status' | 'system' = 'system',
  data?: any
): Notification {
  return {
    id: Date.now().toString(),
    title,
    description,
    type,
    timestamp: new Date(),
    read: false,
    data
  };
}