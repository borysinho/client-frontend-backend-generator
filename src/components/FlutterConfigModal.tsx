import React, { useState } from "react";
import "./css/DatabaseConfigModal.css"; // Reutilizamos los estilos

interface FlutterConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (apiBaseUrl: string) => void;
}

const FlutterConfigModal: React.FC<FlutterConfigModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [apiBaseUrl, setApiBaseUrl] = useState("http://10.0.2.2:4000/api");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(apiBaseUrl);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Configuración del Backend para Flutter</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div
            className="info-box"
            style={{
              background: "#e3f2fd",
              padding: "12px",
              borderRadius: "4px",
              marginBottom: "16px",
              border: "1px solid #2196f3",
            }}
          >
            <p style={{ margin: "0 0 8px 0", fontWeight: "bold" }}>
              📱 Selecciona la URL según tu entorno:
            </p>
            <ul style={{ margin: "0", paddingLeft: "20px" }}>
              <li>
                <strong>Emulador Android:</strong>{" "}
                <code>http://10.0.2.2:4000/api</code> (por defecto)
              </li>
              <li>
                <strong>Dispositivo físico:</strong>{" "}
                <code>http://TU_IP:4000/api</code> (ej:
                http://192.168.1.100:4000/api)
              </li>
              <li>
                <strong>Web/Desktop:</strong>{" "}
                <code>http://localhost:4000/api</code>
              </li>
            </ul>
          </div>

          <div className="form-group">
            <label htmlFor="api-url">URL del Backend API:</label>
            <input
              type="text"
              id="api-url"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              placeholder="http://10.0.2.2:4000/api"
              required
              style={{ fontFamily: "monospace" }}
            />
            <small
              style={{ display: "block", marginTop: "4px", color: "#666" }}
            >
              Puedes cambiar esto más tarde en{" "}
              <code>lib/config/app_config.dart</code>
            </small>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="secondary-button"
            >
              Cancelar
            </button>
            <button type="submit" className="primary-button">
              Generar Frontend Flutter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FlutterConfigModal;
