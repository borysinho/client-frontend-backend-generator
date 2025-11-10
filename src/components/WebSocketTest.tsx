import React, { useState, useEffect, useRef } from "react";

export const WebSocketTest: React.FC = () => {
  const [messages, setMessages] = useState<string[]>([]);
  const [userName, setUserName] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  const addMessage = (message: string) => {
    setMessages((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
  };

  const connect = () => {
    if (!userName.trim()) {
      addMessage("❌ Error: Ingresa un nombre de usuario");
      return;
    }

    try {
      // Conectar al servidor WebSocket en puerto 3000
      const wsUrl = `ws://localhost:3000?name=${encodeURIComponent(userName)}`;
      console.log("🔗 Intentando conectar a:", wsUrl);
      addMessage(`🔗 Conectando a: ${wsUrl}`);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        addMessage("✅ Conectado al servidor WebSocket");
        console.log("✅ WebSocket conectado");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "welcome") {
            addMessage(`👋 ${data.data.message}`);
            addMessage(`🆔 Tu ID: ${data.data.id}`);
          } else if (data.type === "name_updated") {
            addMessage(`📝 Nombre actualizado a: ${data.data.name}`);
          } else if (data.type === "pong") {
            addMessage("🏓 Pong recibido");
          } else {
            addMessage(`📨 ${JSON.stringify(data)}`);
          }
        } catch {
          addMessage(`📨 ${event.data}`);
        }
      };

      ws.onclose = (event) => {
        console.log("🔌 WebSocket cerrado:", event.code, event.reason);
        setIsConnected(false);
        addMessage(
          `❌ Desconectado del servidor: ${event.code} - ${event.reason}`
        );
      };

      ws.onerror = (error) => {
        console.error("❌ Error de WebSocket:", error);
        addMessage(`❌ Error de WebSocket: ${error}`);
      };
    } catch (error) {
      addMessage(`❌ Error al conectar: ${error}`);
    }
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const sendPing = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "ping" }));
      addMessage("🏓 Ping enviado");
    } else {
      addMessage("❌ No hay conexión activa");
    }
  };

  const updateName = () => {
    if (!inputMessage.trim()) {
      addMessage("❌ Error: Ingresa un nuevo nombre");
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "update_name",
          data: { name: inputMessage.trim() },
        })
      );
      addMessage(`📝 Solicitando cambio de nombre a: ${inputMessage.trim()}`);
      setInputMessage("");
    } else {
      addMessage("❌ No hay conexión activa");
    }
  };

  const sendMessage = () => {
    if (!inputMessage.trim()) {
      addMessage("❌ Error: Ingresa un mensaje");
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "message",
          data: { text: inputMessage.trim() },
        })
      );
      addMessage(`📤 Mensaje enviado: ${inputMessage.trim()}`);
      setInputMessage("");
    } else {
      addMessage("❌ No hay conexión activa");
    }
  };

  // Limpiar conexión al desmontar
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: "10px",
        right: "10px",
        width: "350px",
        maxHeight: "80vh",
        backgroundColor: "white",
        border: "2px solid #007bff",
        borderRadius: "8px",
        padding: "15px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        zIndex: 10000,
        fontSize: "12px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <h3 style={{ margin: "0 0 10px 0", color: "#007bff" }}>
        🔌 WebSocket Test
      </h3>

      {/* Estado de conexión */}
      <div style={{ marginBottom: "10px" }}>
        <div
          style={{
            display: "inline-block",
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            backgroundColor: isConnected ? "#28a745" : "#dc3545",
            marginRight: "5px",
          }}
        ></div>
        {isConnected ? "Conectado" : "Desconectado"}
      </div>

      {/* Controles de conexión */}
      <div style={{ marginBottom: "10px" }}>
        <input
          type="text"
          placeholder="Nombre de usuario"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          style={{
            width: "calc(100% - 80px)",
            padding: "5px",
            border: "1px solid #ced4da",
            borderRadius: "4px",
            marginRight: "5px",
          }}
        />
        <button
          onClick={connect}
          disabled={isConnected}
          style={{
            padding: "5px 10px",
            backgroundColor: isConnected ? "#6c757d" : "#28a745",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isConnected ? "not-allowed" : "pointer",
          }}
        >
          {isConnected ? "Conectado" : "Conectar"}
        </button>
      </div>

      {/* Controles de mensajes */}
      <div style={{ marginBottom: "10px" }}>
        <input
          type="text"
          placeholder="Mensaje o nuevo nombre"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && sendMessage()}
          style={{
            width: "calc(100% - 120px)",
            padding: "5px",
            border: "1px solid #ced4da",
            borderRadius: "4px",
            marginRight: "5px",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!isConnected}
          style={{
            padding: "5px",
            backgroundColor: isConnected ? "#007bff" : "#6c757d",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isConnected ? "pointer" : "not-allowed",
            marginRight: "5px",
          }}
        >
          📤
        </button>
        <button
          onClick={updateName}
          disabled={!isConnected}
          style={{
            padding: "5px",
            backgroundColor: isConnected ? "#ffc107" : "#6c757d",
            color: "black",
            border: "none",
            borderRadius: "4px",
            cursor: isConnected ? "pointer" : "not-allowed",
          }}
        >
          📝
        </button>
      </div>

      {/* Botones de control */}
      <div style={{ marginBottom: "10px" }}>
        <button
          onClick={sendPing}
          disabled={!isConnected}
          style={{
            padding: "5px 10px",
            backgroundColor: isConnected ? "#17a2b8" : "#6c757d",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isConnected ? "pointer" : "not-allowed",
            marginRight: "5px",
          }}
        >
          🏓 Ping
        </button>
        <button
          onClick={disconnect}
          disabled={!isConnected}
          style={{
            padding: "5px 10px",
            backgroundColor: isConnected ? "#dc3545" : "#6c757d",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isConnected ? "pointer" : "not-allowed",
          }}
        >
          ❌ Desconectar
        </button>
      </div>

      {/* Área de mensajes */}
      <div
        style={{
          flex: 1,
          border: "1px solid #dee2e6",
          borderRadius: "4px",
          padding: "5px",
          backgroundColor: "#f8f9fa",
          overflowY: "auto",
          fontFamily: "monospace",
          fontSize: "11px",
          minHeight: "150px",
          maxHeight: "300px",
        }}
      >
        {messages.length === 0 ? (
          <div style={{ color: "#6c757d", fontStyle: "italic" }}>
            Los mensajes aparecerán aquí...
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} style={{ marginBottom: "2px" }}>
              {msg}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
