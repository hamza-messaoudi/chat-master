import { Button } from "@/components/ui/button";

interface HeaderProps {
  agentName: string;
  isOnline: boolean;
  unreadCount: number;
  onLogout: () => void;
}

export default function Header({ agentName, isOnline, unreadCount, onLogout }: HeaderProps) {
  return (
    <header className="bg-white shadow-md">
      <div className="flex justify-between items-center px-4 py-2 h-16">
        <div className="flex items-center">
          <span className="material-icons text-primary mr-2">support_agent</span>
          <h1 className="text-xl font-medium">Support Chat Dashboard</h1>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <span className={`material-icons mr-1 ${isOnline ? 'text-success' : 'text-error'}`}>
              circle
            </span>
            <span className="text-sm">{isOnline ? 'Online' : 'Offline'}</span>
          </div>
          <div className="relative">
            <span className="material-icons cursor-pointer">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-error text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center">
            <div className="h-8 w-8 rounded-full bg-accent text-white flex items-center justify-center">
              <span>{agentName.split(' ').map(n => n[0]).join('')}</span>
            </div>
            <span className="ml-2">{agentName}</span>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onLogout}
            className="ml-2"
          >
            <span className="material-icons text-sm mr-1">logout</span>
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
