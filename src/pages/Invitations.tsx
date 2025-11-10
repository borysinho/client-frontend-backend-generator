import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./css/Dashboard.css";

interface BackendInvitation {
  id: string;
  diagramId: string;
  creatorId: string;
  inviteeEmail: string;
  inviteeId?: string;
  status: string;
  message?: string;
  createdAt: string;
  updatedAt: string;
  diagram?: {
    diagramId: string;
    name: string;
  };
  creator?: {
    id: string;
    name: string;
    email: string;
  };
}

interface Invitation {
  id: string;
  diagramId: string;
  creatorId: string;
  inviteeEmail: string;
  inviteeId?: string;
  status: "pending" | "accepted" | "rejected" | "expired";
  message?: string;
  createdAt: string;
  updatedAt: string;
  diagram?: {
    diagramId: string;
    name: string;
  };
  creator?: {
    id: string;
    name: string;
    email: string;
  };
}

interface Diagram {
  id: string;
  diagramId: string;
  name: string;
  description?: string;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
}

const Invitations: React.FC = () => {
  const navigate = useNavigate();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"received" | "sent" | "create">(
    "received"
  );
  const [createForm, setCreateForm] = useState({
    diagramId: "",
    inviteeEmail: "",
    message: "",
  });
  const [isCreating, setIsCreating] = useState(false);

  const loadInvitations = useCallback(async () => {
    try {
      const userStr = localStorage.getItem("user");
      if (!userStr) {
        setInvitations([]);
        return;
      }

      const user = JSON.parse(userStr);
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/invitations/user/${user.id}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const invitationsData: BackendInvitation[] = await response.json();
        // Convertir el status a tipo específico
        const convertedInvitations: Invitation[] = invitationsData.map(
          (inv) => ({
            ...inv,
            status: inv.status as
              | "pending"
              | "accepted"
              | "rejected"
              | "expired",
          })
        );
        setInvitations(convertedInvitations);
      } else {
        setInvitations([]);
      }
    } catch (error) {
      console.error("Error loading invitations:", error);
      setInvitations([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadDiagrams = useCallback(async () => {
    try {
      const userStr = localStorage.getItem("user");
      if (!userStr) return;

      const user = JSON.parse(userStr);
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/diagrams/user/${user.id}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const diagramsData: Diagram[] = await response.json();
        setDiagrams(diagramsData);
      } else {
        setDiagrams([]);
      }
    } catch (error) {
      console.error("Error loading diagrams:", error);
      setDiagrams([]);
    }
  }, []);

  useEffect(() => {
    loadInvitations();
    loadDiagrams();
  }, [loadInvitations, loadDiagrams]);

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const userStr = localStorage.getItem("user");
      if (!userStr) {
        alert("Usuario no encontrado");
        return;
      }

      const user = JSON.parse(userStr);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Expira en 7 días

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/invitations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            diagramId: createForm.diagramId,
            creatorId: user.id,
            inviteeEmail: createForm.inviteeEmail,
            message: createForm.message || undefined,
            expiresAt: expiresAt.toISOString(),
          }),
        }
      );

      if (response.ok) {
        alert("Invitación enviada exitosamente!");
        setCreateForm({ diagramId: "", inviteeEmail: "", message: "" });
        await loadInvitations();
      } else {
        const error = await response.json();
        alert(
          `Error al crear invitación: ${error.error || "Error desconocido"}`
        );
      }
    } catch (error) {
      console.error("Error creating invitation:", error);
      alert("Error al crear la invitación");
    } finally {
      setIsCreating(false);
    }
  };

  const handleAcceptInvitation = async (invitationId: string) => {
    try {
      const userStr = localStorage.getItem("user");
      if (!userStr) {
        alert("Usuario no autenticado");
        return;
      }

      const user = JSON.parse(userStr);

      const response = await fetch(
        `${
          import.meta.env.VITE_API_URL
        }/api/invitations/${invitationId}/accept`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId: user.id }),
        }
      );

      if (response.ok) {
        alert("Invitación aceptada exitosamente!");
        await loadInvitations();
      } else {
        const error = await response.json();
        alert(
          `Error al aceptar invitación: ${error.error || "Error desconocido"}`
        );
      }
    } catch (error) {
      console.error("Error accepting invitation:", error);
      alert("Error al aceptar la invitación");
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    try {
      const userStr = localStorage.getItem("user");
      if (!userStr) {
        alert("Usuario no autenticado");
        return;
      }

      const user = JSON.parse(userStr);

      const response = await fetch(
        `${
          import.meta.env.VITE_API_URL
        }/api/invitations/${invitationId}/reject`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId: user.id }),
        }
      );

      if (response.ok) {
        alert("Invitación rechazada");
        await loadInvitations();
      } else {
        const error = await response.json();
        alert(
          `Error al rechazar invitación: ${error.error || "Error desconocido"}`
        );
      }
    } catch (error) {
      console.error("Error declining invitation:", error);
      alert("Error al rechazar la invitación");
    }
  };

  const getReceivedInvitations = useCallback(() => {
    const userStr = localStorage.getItem("user");
    if (!userStr) return [];

    const user = JSON.parse(userStr);
    return invitations.filter(
      (invitation) =>
        invitation.inviteeEmail === user.email &&
        invitation.creatorId !== user.id
    );
  }, [invitations]);

  const getSentInvitations = useCallback(() => {
    const userStr = localStorage.getItem("user");
    if (!userStr) return [];

    const user = JSON.parse(userStr);
    return invitations.filter((invitation) => invitation.creatorId === user.id);
  }, [invitations]);

  // Debug effect
  useEffect(() => {
    if (invitations.length > 0) {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        console.log("=== DEBUG INVITATIONS ===");
        console.log("User data:", { id: user.id, email: user.email });
        console.log(
          "All invitations:",
          invitations.map((inv) => ({
            id: inv.id,
            creatorId: inv.creatorId,
            inviteeEmail: inv.inviteeEmail,
            status: inv.status,
          }))
        );

        const received = getReceivedInvitations();
        const sent = getSentInvitations();
        console.log(
          "Received invitations:",
          received.length,
          received.map((inv) => inv.id)
        );
        console.log(
          "Sent invitations:",
          sent.length,
          sent.map((inv) => inv.id)
        );
        console.log("=========================");
      }
    }
  }, [invitations, getReceivedInvitations, getSentInvitations]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#ffa500";
      case "accepted":
        return "#28a745";
      case "rejected":
        return "#dc3545";
      case "expired":
        return "#6c757d";
      default:
        return "#6c757d";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Pendiente";
      case "accepted":
        return "Aceptada";
      case "rejected":
        return "Rechazada";
      case "expired":
        return "Expirada";
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard">
        <header className="dashboard-header">
          <h1>Invitaciones</h1>
        </header>
        <main className="dashboard-main">
          <div className="loading">Cargando invitaciones...</div>
        </main>
      </div>
    );
  }

  const receivedInvitations = getReceivedInvitations();
  const sentInvitations = getSentInvitations();

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-title-section">
            <button
              onClick={() => navigate("/dashboard")}
              className="dashboard-link-button"
            >
              ← Volver al Dashboard
            </button>
            <h1>Invitaciones</h1>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="tabs">
          <button
            className={`tab-button ${activeTab === "received" ? "active" : ""}`}
            onClick={() => setActiveTab("received")}
          >
            Recibidas ({receivedInvitations.length})
          </button>
          <button
            className={`tab-button ${activeTab === "sent" ? "active" : ""}`}
            onClick={() => setActiveTab("sent")}
          >
            Enviadas ({sentInvitations.length})
          </button>
          <button
            className={`tab-button ${activeTab === "create" ? "active" : ""}`}
            onClick={() => setActiveTab("create")}
          >
            Crear Invitación
          </button>
        </div>

        {activeTab === "received" && (
          <section className="invitations-section">
            <h2>Invitaciones Recibidas</h2>
            {receivedInvitations.length === 0 ? (
              <p className="no-invitations">
                No tienes invitaciones pendientes
              </p>
            ) : (
              <div className="invitations-list">
                {receivedInvitations.map((invitation) => (
                  <div key={invitation.id} className="invitation-card">
                    <div className="invitation-info">
                      <h4>{invitation.diagram?.name || "Diagrama"}</h4>
                      <p>
                        Invitado por:{" "}
                        {invitation.creator?.name ||
                          invitation.creator?.email ||
                          "Usuario"}
                      </p>
                      <p>
                        Estado:{" "}
                        <span
                          style={{
                            color: getStatusColor(invitation.status),
                            fontWeight: "bold",
                          }}
                        >
                          {getStatusText(invitation.status)}
                        </span>
                      </p>
                      {invitation.message && (
                        <p>Mensaje: {invitation.message}</p>
                      )}
                      <p>
                        Fecha:{" "}
                        {new Date(invitation.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="invitation-actions">
                      {invitation.status === "pending" && (
                        <>
                          <button
                            onClick={() =>
                              handleAcceptInvitation(invitation.id)
                            }
                            className="accept-button"
                          >
                            Aceptar
                          </button>
                          <button
                            onClick={() =>
                              handleDeclineInvitation(invitation.id)
                            }
                            className="decline-button"
                          >
                            Rechazar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "sent" && (
          <section className="invitations-section">
            <h2>Invitaciones Enviadas</h2>
            {sentInvitations.length === 0 ? (
              <p className="no-invitations">No has enviado invitaciones</p>
            ) : (
              <div className="invitations-list">
                {sentInvitations.map((invitation) => (
                  <div key={invitation.id} className="invitation-card">
                    <div className="invitation-info">
                      <h4>{invitation.diagram?.name || "Diagrama"}</h4>
                      <p>Invitado: {invitation.inviteeEmail}</p>
                      <p>
                        Estado:{" "}
                        <span
                          style={{
                            color: getStatusColor(invitation.status),
                            fontWeight: "bold",
                          }}
                        >
                          {getStatusText(invitation.status)}
                        </span>
                      </p>
                      {invitation.message && (
                        <p>Mensaje: {invitation.message}</p>
                      )}
                      <p>
                        Fecha:{" "}
                        {new Date(invitation.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "create" && (
          <section className="invitations-section">
            <h2>Crear Nueva Invitación</h2>
            <div className="create-invitation-form">
              <form onSubmit={handleCreateInvitation}>
                <div className="form-group">
                  <label htmlFor="diagramId">Seleccionar Diagrama:</label>
                  <select
                    id="diagramId"
                    value={createForm.diagramId}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        diagramId: e.target.value,
                      })
                    }
                    required
                  >
                    <option value="">Selecciona un diagrama...</option>
                    {diagrams.map((diagram) => (
                      <option key={diagram.id} value={diagram.diagramId}>
                        {diagram.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="inviteeEmail">Email del Invitado:</label>
                  <input
                    type="email"
                    id="inviteeEmail"
                    value={createForm.inviteeEmail}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        inviteeEmail: e.target.value,
                      })
                    }
                    placeholder="correo@ejemplo.com"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="message">Mensaje (opcional):</label>
                  <textarea
                    id="message"
                    value={createForm.message}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, message: e.target.value })
                    }
                    placeholder="Agrega un mensaje personalizado para la invitación..."
                    rows={3}
                  />
                </div>

                <button
                  type="submit"
                  className="create-invitation-button"
                  disabled={isCreating || diagrams.length === 0}
                >
                  {isCreating ? "Enviando..." : "Enviar Invitación"}
                </button>
              </form>

              {diagrams.length === 0 && (
                <p className="no-diagrams-message">
                  No tienes diagramas para compartir. Crea un diagrama primero.
                </p>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default Invitations;
