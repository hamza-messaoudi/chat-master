import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { Notification, createNotification } from '../components/agent/NotificationsMenu';
import { useToast } from '@/hooks/use-toast';

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (title: string, description: string, type?: 'message' | 'status' | 'system', data?: any) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { toast } = useToast();

  const addNotification = useCallback((
    title: string, 
    description: string,
    type: 'message' | 'status' | 'system' = 'system',
    data?: any
  ) => {
    const notification = createNotification(title, description, type, data);
    setNotifications(prev => [notification, ...prev].slice(0, 50)); // Keep max 50 notifications
    
    // Also show as a toast with short duration
    toast({
      title,
      description,
      duration: 3000, // 3 seconds
    });
  }, [toast]);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => 
      prev.map(n => ({ ...n, read: true }))
    );
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider 
      value={{ 
        notifications, 
        addNotification, 
        markAsRead, 
        markAllAsRead, 
        clearNotifications 
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}