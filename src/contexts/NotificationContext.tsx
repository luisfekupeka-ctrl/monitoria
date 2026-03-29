import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Loan } from '../types';

export interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'alert' | 'info' | 'success';
  read: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (title: string, message: string, type?: 'alert' | 'info' | 'success') => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
  const [alertDismissed, setAlertDismissed] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const fetchActiveLoans = useCallback(async () => {
    const { data } = await supabase
      .from('loans')
      .select('*, loan_items(notebook_code)')
      .eq('status', 'active');

    if (data) {
      setActiveLoans(data.map((l: any) => ({
        ...l,
        beneficiaryName: l.beneficiary_name || 'N/A',
        items: Array.isArray(l.loan_items) ? l.loan_items.map((item: any) => item.notebook_code) : []
      })));
    }
  }, []);

  useEffect(() => {
    fetchActiveLoans();
    // Refresh every 5 minutes
    const interval = setInterval(fetchActiveLoans, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchActiveLoans]);

  const addNotification = useCallback((title: string, message: string, type: 'alert' | 'info' | 'success' = 'info') => {
    const newNotify: Notification = {
      id: Date.now().toString(),
      title,
      message,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      type,
      read: false
    };
    setNotifications(prev => [newNotify, ...prev]);
  }, []);

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // 17:40 Alert Logic
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();

      // Trigger reminder at 17:40
      if (hours === 17 && minutes === 40 && !alertDismissed && activeLoans.length > 0) {
        const names = activeLoans.map(l => l.beneficiaryName).join(', ');
        addNotification(
          '🚨 Alerta de Devolução', 
          `O horário de 17:45 se aproxima. Pendente com: ${names}`, 
          'alert'
        );
        setAlertDismissed(true);
      }

      // Reset at midnight
      if (hours === 0 && minutes === 0) setAlertDismissed(false);
    }, 60000);

    return () => clearInterval(timer);
  }, [activeLoans, alertDismissed, addNotification]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      addNotification,
      markAsRead,
      markAllAsRead,
      removeNotification
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
