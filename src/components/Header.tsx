import React from "react";
import { useNavigate } from "react-router-dom";
import ConnectionStatusBar from "./ConnectionStatusBar";
import "./css/Header.css";
import type { JsonPatchOperation } from "../hooks/useDiagramSync";
import type { Socket } from "socket.io-client";

interface HeaderProps {
  title?: string;
  operations?: JsonPatchOperation[];
  socket?: Socket;
  onSave?: () => void;
  isAutoSaving?: boolean;
}

const Header: React.FC<HeaderProps> = ({
  title = "Diagrama UML Colaborativo",
  operations = [],
  socket,
  onSave,
  isAutoSaving = false,
}) => {
  const navigate = useNavigate();

  const handleBackToDashboard = async () => {
    // Guardar el diagrama antes de navegar
    if (onSave) {
      await onSave();
      // Dar un pequeño delay para que se complete el guardado
      setTimeout(() => {
        navigate("/dashboard");
      }, 300);
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-title-section">
          <button
            onClick={handleBackToDashboard}
            className="dashboard-link dashboard-link-button"
          >
            ← Volver al Dashboard
          </button>
          <h1 className="app-title">{title}</h1>
        </div>

        <div className="header-actions">
          {isAutoSaving && (
            <div className="auto-save-indicator">
              <span className="auto-save-spinner">⟳</span>
              Guardando...
            </div>
          )}
          {onSave && (
            <button onClick={onSave} className="save-button">
              💾 Guardar Diagrama
            </button>
          )}
          <ConnectionStatusBar operations={operations} socket={socket} />
        </div>
      </div>
    </header>
  );
};

export default Header;
