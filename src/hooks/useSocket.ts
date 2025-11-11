import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

export function useSocket(url?: string) {
  // Usar la URL del backend desde variables de entorno, con fallback a localhost:3001
  // Evitar que la cadena literal "undefined" sea tomada como URL válida
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  const resolvedEnvUrl = envUrl && envUrl !== "undefined" ? envUrl : undefined;
  const backendUrl = url || resolvedEnvUrl || "http://localhost:3001";
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Crear conexión Socket.IO
    const newSocket = io(backendUrl, {
      transports: ["websocket", "polling"],
      timeout: 5000,
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Manejar conexión exitosa
    newSocket.on("connect", () => {
      console.log("Conectado al servidor:", newSocket.id);
      setIsConnected(true);
      setConnectionError(null);
    });

    // Manejar errores de conexión
    newSocket.on("connect_error", (error) => {
      console.error("Error de conexión:", error);
      setConnectionError(error.message);
      setIsConnected(false);
    });

    // Manejar desconexión
    newSocket.on("disconnect", (reason) => {
      console.log("Desconectado del servidor:", reason);
      setIsConnected(false);
    });

    // Cleanup al desmontar
    return () => {
      newSocket.close();
      socketRef.current = null;
    };
  }, [backendUrl]);

  return {
    socket,
    isConnected,
    connectionError,
  };
}
