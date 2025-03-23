import { Button } from "@/components/ui/button";

interface HeaderProps {
  agentName: string;
  isOnline: boolean;
  unreadCount: number;
  onLogout: () => void;
}

export default function Header({ onLogout }: HeaderProps) {
  return (
    <header className="bg-white shadow-md">
      <div className="flex justify-end items-center px-4 py-2 h-16">
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
    </header>
  );
}
