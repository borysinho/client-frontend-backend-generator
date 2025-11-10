import { useState, useCallback, useRef, useEffect } from "react";
import type { Notification } from "../components/NotificationSystem";

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const counterRef = useRef(0);
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Limpiar timeouts cuando el componente se desmonte
  useEffect(() => {
    const currentTimeouts = timeoutsRef.current;
    return () => {
      currentTimeouts.forEach((timeout) => clearTimeout(timeout));
      currentTimeouts.clear();
    };
  }, []);

  const removeNotification = useCallback((id: string) => {
    // Limpiar cualquier timeout pendiente para esta notificación
    const existingTimeout = timeoutsRef.current.get(id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      timeoutsRef.current.delete(id);
    }

    // Remover directamente la notificación
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNotification = useCallback(
    (
      type: Notification["type"],
      title: string,
      message: string,
      autoClose: boolean = true,
      duration: number = 5000
    ) => {
      const id = `notification-${++counterRef.current}`;
      const notification: Notification = {
        id,
        type,
        title,
        message,
        timestamp: new Date(),
        autoClose,
        duration,
      };

      setNotifications((prev) => [notification, ...prev]);

      if (autoClose) {
        const timeout = setTimeout(() => {
          removeNotification(id);
          timeoutsRef.current.delete(id);
        }, duration);
        timeoutsRef.current.set(id, timeout);
      }

      return id;
    },
    [removeNotification]
  );

  const clearAllNotifications = useCallback(() => {
    // Limpiar todos los timeouts pendientes
    timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    timeoutsRef.current.clear();
    setNotifications([]);
  }, []);

  return {
    notifications,
    addNotification,
    removeNotification,
    clearAllNotifications,
  };
}
