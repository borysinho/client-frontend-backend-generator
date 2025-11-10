import React, { useState, useRef, useEffect } from "react";
import { AIService } from "../services/AIService";
import type { DiagramDelta } from "../services/AIService";
import type { CustomElement, UMLRelationship } from "../types";
import type { Socket } from "socket.io-client";

interface AIBotProps {
  onGenerateDiagram: (delta: DiagramDelta) => void;
  existingClasses: string[];
  currentElements: CustomElement[];
  currentRelationships: UMLRelationship[];
  isVisible: boolean;
  onClose: () => void;
  diagramId?: string;
  userId?: string;
  userName?: string;
  socket?: Socket | null; // Recibir socket desde App
}

export const AIBot: React.FC<AIBotProps> = ({
  onGenerateDiagram,
  existingClasses,
  currentElements,
  currentRelationships,
  isVisible,
  onClose,
  diagramId,
  userId,
  userName,
  socket, // Recibir socket como prop
}) => {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const aiService = new AIService();
  const [messages, setMessages] = useState<
    Array<{
      id: string;
      type: "user" | "ai" | "error" | "info";
      content: string;
      timestamp: number;
      image?: string;
      userName?: string; // Para mostrar quién hizo la solicitud
    }>
  >([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Verificar si el diagrama está vacío (solo permitir imagen si está vacío)
  const isDiagramEmpty =
    currentElements.length === 0 && currentRelationships.length === 0;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Escuchar eventos de Socket.IO para IA
  useEffect(() => {
    if (!socket) return;

    // Cuando la IA está procesando (cualquier usuario)
    const handleAIProcessing = (data: {
      userId: string;
      userName: string;
      prompt: string;
      timestamp: number;
    }) => {
      // Solo mostrar si es otro usuario
      if (data.userId !== socket.id) {
        addMessage(
          "info",
          `⏳ ${data.userName} está consultando a la IA: "${data.prompt}"`,
          undefined,
          data.userName
        );
      }
    };

    // Cuando llega una respuesta de IA (para todos los usuarios)
    const handleAIResponse = (data: {
      delta: DiagramDelta;
      prompt: string;
      userId: string;
      userName: string;
      timestamp: number;
    }) => {
      const {
        newElements,
        newRelationships,
        removeElementIds,
        removeRelationshipIds,
        updateElements,
        updateRelationships,
      } = data.delta;

      // Construir mensaje descriptivo
      const changes: string[] = [];
      if (newElements.length > 0)
        changes.push(`${newElements.length} elementos nuevos`);
      if (newRelationships.length > 0)
        changes.push(`${newRelationships.length} relaciones nuevas`);
      if (removeElementIds && removeElementIds.length > 0)
        changes.push(`${removeElementIds.length} elementos eliminados`);
      if (removeRelationshipIds && removeRelationshipIds.length > 0)
        changes.push(`${removeRelationshipIds.length} relaciones eliminadas`);
      if (updateElements && updateElements.length > 0)
        changes.push(`${updateElements.length} elementos modificados`);
      if (updateRelationships && updateRelationships.length > 0)
        changes.push(`${updateRelationships.length} relaciones modificadas`);

      const message =
        changes.length > 0
          ? `✅ ${
              data.userId === socket.id ? "Diagrama" : data.userName
            } actualizado: ${changes.join(", ")}`
          : "✅ Sin cambios necesarios";

      addMessage("ai", message, undefined, data.userName);

      // Aplicar el delta al diagrama
      onGenerateDiagram(data.delta);

      // Detener loading si era la solicitud de este usuario
      if (data.userId === socket.id) {
        setIsLoading(false);
      }
    };

    // Cuando hay un error de IA
    const handleAIError = (data: {
      error: string;
      userId: string;
      userName: string;
      timestamp: number;
    }) => {
      addMessage(
        "error",
        `❌ Error${data.userId === socket.id ? "" : ` (${data.userName})`}: ${
          data.error
        }`,
        undefined,
        data.userName
      );

      if (data.userId === socket.id) {
        setIsLoading(false);
      }
    };

    socket.on("ai:processing", handleAIProcessing);
    socket.on("ai:response", handleAIResponse);
    socket.on("ai:error", handleAIError);

    return () => {
      socket.off("ai:processing", handleAIProcessing);
      socket.off("ai:response", handleAIResponse);
      socket.off("ai:error", handleAIError);
    };
  }, [socket, onGenerateDiagram]);

  const addMessage = (
    type: "user" | "ai" | "error" | "info",
    content: string,
    image?: string,
    userName?: string
  ) => {
    const newMessage = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: Date.now(),
      image,
      userName,
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith("image/")) {
      addMessage(
        "error",
        "❌ Por favor selecciona un archivo de imagen válido (PNG, JPG, etc.)"
      );
      return;
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      addMessage("error", "❌ La imagen es demasiado grande. Máximo 5MB.");
      return;
    }

    // Convertir a base64
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target?.result as string;
      setSelectedImage(base64String);
      addMessage("user", `📷 Imagen seleccionada: ${file.name}`, base64String);
    };
    reader.onerror = () => {
      addMessage("error", "❌ Error al leer la imagen");
    };
    reader.readAsDataURL(file);
  };

  const handleClearImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const userMessage = input.trim() || "Analizar imagen";
    setInput("");

    // Solo agregar mensaje de texto si no hay imagen ya mostrada
    if (!selectedImage) {
      addMessage("user", userMessage, undefined, userName);
    }

    setIsLoading(true);

    try {
      // Construir la solicitud para la IA
      const request = {
        action: selectedImage ? "generate_from_image" : "generate_diagram",
        prompt: userMessage,
        clientId: userId || socket?.id || "unknown",
        image: selectedImage || undefined,
        context: {
          existingClasses,
          diagramElements: currentElements,
          diagramRelationships: currentRelationships,
        },
      };

      // Si hay imagen, limpiarla después de construir la solicitud
      if (selectedImage) {
        handleClearImage();
      }

      // Emitir evento Socket.IO en lugar de hacer solicitud HTTP
      if (socket) {
        socket.emit("ai:request", {
          request,
          userName: userName || "Usuario Anónimo",
          userId: userId || socket.id,
          diagramId: diagramId,
        });

        // El loading se detendrá cuando llegue la respuesta via socket
      } else {
        // Fallback a HTTP si no hay socket conectado
        console.warn("Socket no conectado, usando HTTP como fallback");

        let response;
        if (selectedImage) {
          response = await aiService.generateFromImage(
            selectedImage,
            userMessage,
            existingClasses,
            currentElements,
            currentRelationships
          );
        } else {
          response = await aiService.generateDiagram(
            userMessage,
            existingClasses,
            currentElements,
            currentRelationships
          );
        }

        // Procesar respuesta HTTP
        if (response.success && response.delta) {
          const {
            newElements,
            newRelationships,
            removeElementIds,
            removeRelationshipIds,
            updateElements,
            updateRelationships,
          } = response.delta;

          const changes: string[] = [];
          if (newElements.length > 0)
            changes.push(`${newElements.length} elementos nuevos`);
          if (newRelationships.length > 0)
            changes.push(`${newRelationships.length} relaciones nuevas`);
          if (removeElementIds && removeElementIds.length > 0)
            changes.push(`${removeElementIds.length} elementos eliminados`);
          if (removeRelationshipIds && removeRelationshipIds.length > 0)
            changes.push(
              `${removeRelationshipIds.length} relaciones eliminadas`
            );
          if (updateElements && updateElements.length > 0)
            changes.push(`${updateElements.length} elementos modificados`);
          if (updateRelationships && updateRelationships.length > 0)
            changes.push(
              `${updateRelationships.length} relaciones modificadas`
            );

          const message =
            changes.length > 0
              ? `✅ Diagrama actualizado: ${changes.join(", ")}`
              : "✅ Sin cambios necesarios";

          addMessage("ai", message);
          onGenerateDiagram(response.delta);
        } else {
          addMessage(
            "error",
            `❌ Error: ${response.error || "Respuesta inválida de la IA"}`
          );
        }
        setIsLoading(false);
      }
    } catch (error) {
      addMessage(
        "error",
        `❌ Error de conexión: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
      setIsLoading(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        width: "400px",
        height: "600px",
        background: "white",
        border: "1px solid #ddd",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #eee",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#f8f9fa",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "16px", color: "#333" }}>
          🤖 Asistente IA UML
        </h3>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            fontSize: "18px",
            cursor: "pointer",
            color: "#666",
          }}
        >
          ×
        </button>
      </div>

      {/* Action Description */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #eee",
          background: "#fafafa",
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
          🤖 {isDiagramEmpty ? "Crear Diagrama" : "Completar Diagrama"}
        </div>
        <p
          style={{
            margin: "0 0 8px 0",
            fontSize: "12px",
            color: "#666",
            lineHeight: "1.4",
          }}
        >
          {isDiagramEmpty
            ? "Describe tu diagrama en texto o sube una imagen de un boceto/diagrama dibujado a mano."
            : "Describe los cambios que quieres hacer en tu diagrama UML y la IA los aplicará automáticamente."}
        </p>

        {/* Botón para subir imagen - SOLO si el diagrama está vacío */}
        {isDiagramEmpty && (
          <div style={{ marginTop: "8px" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              style={{ display: "none" }}
              id="image-upload"
            />
            <label
              htmlFor="image-upload"
              style={{
                display: "inline-block",
                padding: "6px 12px",
                background: selectedImage ? "#28a745" : "#007bff",
                color: "white",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "500",
              }}
            >
              {selectedImage ? "✅ Imagen cargada" : "📷 Subir Imagen"}
            </label>
            {selectedImage && (
              <button
                onClick={handleClearImage}
                style={{
                  marginLeft: "8px",
                  padding: "6px 12px",
                  background: "#dc3545",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "500",
                }}
              >
                ❌ Quitar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          background: "#fafafa",
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              textAlign: "center",
              color: "#999",
              fontStyle: "italic",
              marginTop: "100px",
            }}
          >
            ¡Hola! Soy tu asistente IA para diagramas UML.
            <br />
            {isDiagramEmpty
              ? "Sube una imagen de un boceto o describe tu diagrama en texto."
              : "Describe los cambios que quieres hacer en tu diagrama."}
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                background:
                  message.type === "user"
                    ? "#007bff"
                    : message.type === "ai"
                    ? "#28a745"
                    : message.type === "info"
                    ? "#17a2b8"
                    : "#dc3545",
                color: "white",
                fontSize: "14px",
                wordWrap: "break-word",
              }}
            >
              {message.content}
            </div>
            {message.image && (
              <img
                src={message.image}
                alt="Imagen subida"
                style={{
                  maxWidth: "100%",
                  marginTop: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                }}
              />
            )}
          </div>
        ))}
        {isLoading && (
          <div
            style={{
              padding: "8px 12px",
              color: "#666",
              fontStyle: "italic",
            }}
          >
            🤔 {selectedImage ? "Analizando imagen..." : "Pensando..."}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        style={{
          padding: "16px",
          borderTop: "1px solid #eee",
          background: "white",
        }}
      >
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              selectedImage
                ? "Descripción adicional (opcional)..."
                : isDiagramEmpty
                ? "Describe tu diagrama UML..."
                : "Describe los cambios que necesitas..."
            }
            disabled={isLoading}
            style={{
              flex: 1,
              padding: "8px 12px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontSize: "14px",
            }}
          />
          <button
            type="submit"
            disabled={isLoading || (!input.trim() && !selectedImage)}
            style={{
              padding: "8px 16px",
              background:
                isLoading || (!input.trim() && !selectedImage)
                  ? "#ccc"
                  : "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor:
                isLoading || (!input.trim() && !selectedImage)
                  ? "not-allowed"
                  : "pointer",
              fontSize: "14px",
            }}
          >
            {isLoading ? "..." : "Enviar"}
          </button>
        </div>
      </form>
    </div>
  );
};
