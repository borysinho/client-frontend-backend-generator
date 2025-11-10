import React from "react";
import "./css/NotificationSystem.css";

export interface Notification {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  timestamp: Date;
  autoClose?: boolean;
  duration?: number;
}

interface NotificationSystemProps {
  notifications: Notification[];
  onRemove: (id: string) => void;
}

const NotificationSystem: React.FC<NotificationSystemProps> = ({
  notifications,
  onRemove,
}) => {
  return (
    <div className="notification-system">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`notification notification-${notification.type}`}
        >
          <div className="notification-header">
            <div className="notification-icon">
              {notification.type === "success" && "✅"}
              {notification.type === "error" && "❌"}
              {notification.type === "warning" && "⚠️"}
              {notification.type === "info" && "ℹ️"}
            </div>
            <div className="notification-title">{notification.title}</div>
            <button
              className="notification-close"
              onClick={() => onRemove(notification.id)}
            >
              ✕
            </button>
          </div>
          <div className="notification-message">{notification.message}</div>
          <div className="notification-timestamp">
            {notification.timestamp.toLocaleTimeString()}
          </div>
        </div>
      ))}
    </div>
  );
};

export default NotificationSystem;
