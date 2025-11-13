import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import "./css/Dashboard.css";

interface InvitationDetails {
  id: string;
  diagramId: string;
  creatorId: string;
  inviteeEmail: string;
  status: string;
  message?: string;
  createdAt: string;
  expiresAt: string;
  diagram?: {
    diagramId: string;
    name: string;
    description?: string;
  };
  creator?: {
    id: string;
    name: string;
    email: string;
  };
}

const InvitationPage: React.FC = () => {
  console.log("InvitationPage component rendered");
  const { invitationId } = useParams<{ invitationId: string }>();
  const [searchParams] = useSearchParams();
  console.log("InvitationPage invitationId:", invitationId);
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  console.log("InvitationPage rendered with invitationId:", invitationId);

  const loadInvitation = useCallback(async () => {
    console.log("loadInvitation called with invitationId:", invitationId);
    if (!invitationId) {
      console.log("No invitationId provided");
      setError("ID de invitación no válido");
      setIsLoading(false);
      return;
    }

    try {
      const apiUrl = `${
        import.meta.env.VITE_API_URL
      }/api/invitations/${invitationId}`;
      console.log("Fetching from URL:", apiUrl);
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);

      if (response.ok) {
        const invitationData = await response.json();
        console.log("Invitation data received:", invitationData);
        console.log("Diagram data:", invitationData.diagram);
        console.log("Creator data:", invitationData.creator);
        setInvitation(invitationData);
      } else if (response.status === 404) {
        console.log("Invitation not found (404)");
        setError("Invitación no encontrada o expirada");
      } else {
        console.log("Other error status:", response.status);
        setError("Error al cargar la invitación");
      }
    } catch (error) {
      console.error("Error loading invitation:", error);
      setError("Error de conexión");
    } finally {
      setIsLoading(false);
    }
  }, [invitationId]);

  useEffect(() => {
    loadInvitation();
  }, [loadInvitation]);

  // Procesar acciones automáticas desde parámetros de query (desde emails)
  useEffect(() => {
    const action = searchParams.get('action');
    if (action && invitation && !isProcessing) {
      const processAction = async () => {
        try {
          setIsProcessing(true);
          
          if (action === 'accept') {
            // Verificar si el usuario está logueado
            const userStr = localStorage.getItem("user");
            if (!userStr) {
              // Usuario no logueado - redirigir al login con parámetro de redirección
              navigate(`/login?redirect=/invitation/${invitationId}`);
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
                body: JSON.stringify({
                  userId: user.id,
                }),
              }
            );

            if (response.ok) {
              alert(
                "¡Invitación aceptada exitosamente! Ahora eres colaborador del diagrama."
              );
              navigate("/dashboard");
            } else {
              const errorData = await response.json();
              alert(
                `Error al aceptar invitación: ${
                  errorData.error || "Error desconocido"
                }`
              );
            }
          } else if (action === 'reject') {
            const userStr = localStorage.getItem("user");
            if (!userStr) {
              alert("Debes iniciar sesión para rechazar la invitación");
              navigate(`/login?redirect=/invitation/${invitationId}`);
              return;
            }

            const response = await fetch(
              `${
                import.meta.env.VITE_API_URL
              }/api/invitations/${invitationId}/reject`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
              }
            );

            if (response.ok) {
              alert("Invitación rechazada");
              navigate("/dashboard");
            } else {
              const errorData = await response.json();
              alert(
                `Error al rechazar invitación: ${
                  errorData.error || "Error desconocido"
                }`
              );
            }
          }
        } catch (error) {
          console.error("Error processing invitation action:", error);
          alert("Error al procesar la invitación");
        } finally {
          setIsProcessing(false);
        }
      };
      processAction();
    }
  }, [invitation, isProcessing, searchParams, invitationId, navigate]);

  const handleAccept = async () => {
    if (!invitation) return;

    // Verificar si el usuario está logueado
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      // Usuario no logueado - redirigir al login con parámetro de redirección
      navigate(`/login?redirect=/invitation/${invitationId}`);
      return;
    }

    const user = JSON.parse(userStr);
    setIsProcessing(true);

    try {
      const response = await fetch(
        `${
          import.meta.env.VITE_API_URL
        }/api/invitations/${invitationId}/accept`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: user.id,
          }),
        }
      );

      if (response.ok) {
        alert(
          "¡Invitación aceptada exitosamente! Ahora eres colaborador del diagrama."
        );
        navigate("/dashboard");
      } else {
        const errorData = await response.json();
        alert(
          `Error al aceptar invitación: ${
            errorData.error || "Error desconocido"
          }`
        );
      }
    } catch (error) {
      console.error("Error accepting invitation:", error);
      alert("Error al aceptar la invitación");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!invitation) return;

    const userStr = localStorage.getItem("user");
    if (!userStr) {
      alert("Debes iniciar sesión para rechazar la invitación");
      navigate(`/login?redirect=/invitation/${invitationId}`);
      return;
    }

    setIsProcessing(true);

    try {
      const response = await fetch(
        `${
          import.meta.env.VITE_API_URL
        }/api/invitations/${invitationId}/reject`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        alert("Invitación rechazada");
        navigate("/dashboard");
      } else {
        const errorData = await response.json();
        alert(
          `Error al rechazar invitación: ${
            errorData.error || "Error desconocido"
          }`
        );
      }
    } catch (error) {
      console.error("Error rejecting invitation:", error);
      alert("Error al rechazar la invitación");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoginRedirect = () => {
    navigate(`/login?redirect=/invitation/${invitationId}`);
  };

  const handleRegisterRedirect = () => {
    navigate(
      `/register?email=${invitation?.inviteeEmail}&redirect=/invitation/${invitationId}`
    );
  };

  if (isLoading) {
    return (
      <div className="dashboard">
        <header className="dashboard-header">
          <div className="header-content invitation-header">
            <h1>Invitación para Colaborar</h1>
          </div>
        </header>
        <main className="dashboard-main">
          <div className="loading">Cargando invitación...</div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard">
        <header className="dashboard-header">
          <div className="header-content invitation-header">
            <h1>Error</h1>
          </div>
        </header>
        <main className="dashboard-main">
          <div className="error-state">
            <p className="error-message">{error}</p>
            <button
              onClick={() => navigate("/dashboard")}
              className="create-button"
            >
              Ir al Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="dashboard">
        <header className="dashboard-header">
          <div className="header-content invitation-header">
            <h1>Invitación no encontrada</h1>
          </div>
        </header>
        <main className="dashboard-main">
          <div className="error-state">
            <p className="error-message">
              No se pudo encontrar la invitación solicitada.
            </p>
            <button
              onClick={() => navigate("/dashboard")}
              className="create-button"
            >
              Ir al Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  const isExpired = new Date(invitation.expiresAt) < new Date();
  const isLoggedIn = !!localStorage.getItem("user");

  console.log("Rendering invitation page:", {
    isLoading,
    error,
    invitation: !!invitation,
    isExpired,
    isLoggedIn,
  });

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content invitation-header">
          <div className="header-title-section">
            <button
              onClick={() => navigate("/dashboard")}
              className="dashboard-link-button"
            >
              ← Volver al Dashboard
            </button>
            <h1>Invitación para Colaborar</h1>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="invitation-detail-container">
          <div className="invitation-detail-card">
            {/* Información del diagrama */}
            <div className="invitation-detail-section">
              <h2 className="section-title">📐 Diagrama</h2>
              <div className="detail-item">
                <span className="detail-label">Nombre:</span>
                <span className="detail-value">
                  {invitation.diagram?.name || "Sin nombre"}
                </span>
              </div>
              {invitation.diagram?.description && (
                <div className="detail-item">
                  <span className="detail-label">Descripción:</span>
                  <span className="detail-value">
                    {invitation.diagram.description}
                  </span>
                </div>
              )}
            </div>

            {/* Información del creador */}
            <div className="invitation-detail-section">
              <h2 className="section-title">👤 Creador</h2>
              <div className="detail-item">
                <span className="detail-label">Nombre:</span>
                <span className="detail-value">
                  {invitation.creator?.name || "Usuario"}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Email:</span>
                <span className="detail-value">
                  {invitation.creator?.email || "No disponible"}
                </span>
              </div>
            </div>

            {/* Información de la invitación */}
            <div className="invitation-detail-section">
              <h2 className="section-title">📧 Detalles de la Invitación</h2>
              {invitation.message && (
                <div className="detail-item message-item">
                  <span className="detail-label">Mensaje del creador:</span>
                  <p className="detail-message">{invitation.message}</p>
                </div>
              )}
              <div className="detail-item">
                <span className="detail-label">Email invitado:</span>
                <span className="detail-value">{invitation.inviteeEmail}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Estado:</span>
                <span className={`status-badge status-${invitation.status}`}>
                  {invitation.status === "pending"
                    ? "⏳ Pendiente"
                    : invitation.status === "accepted"
                    ? "✅ Aceptada"
                    : invitation.status === "rejected"
                    ? "❌ Rechazada"
                    : "📅 Expirada"}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Fecha de creación:</span>
                <span className="detail-value">
                  {new Date(invitation.createdAt).toLocaleDateString("es-ES", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Expira:</span>
                <span className="detail-value">
                  {new Date(invitation.expiresAt).toLocaleDateString("es-ES", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                  {isExpired && (
                    <span className="expired-badge"> (Expirada)</span>
                  )}
                </span>
              </div>
            </div>

            {/* Acciones */}
            {invitation.status === "pending" && !isExpired && (
              <div className="invitation-actions-container">
                {isLoggedIn ? (
                  <>
                    <p className="action-prompt">
                      ¿Deseas aceptar esta invitación para colaborar en el
                      diagrama?
                    </p>
                    <div className="action-buttons">
                      <button
                        onClick={handleAccept}
                        disabled={isProcessing}
                        className="accept-button"
                      >
                        {isProcessing
                          ? "Procesando..."
                          : "✓ Aceptar Invitación"}
                      </button>
                      <button
                        onClick={handleReject}
                        disabled={isProcessing}
                        className="decline-button"
                      >
                        {isProcessing
                          ? "Procesando..."
                          : "✗ Rechazar Invitación"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="action-prompt">
                      Debes iniciar sesión o registrarte para aceptar la
                      invitación
                    </p>
                    <div className="action-buttons">
                      <button
                        onClick={handleLoginRedirect}
                        className="create-button"
                      >
                        🔑 Iniciar Sesión
                      </button>
                      <button
                        onClick={handleRegisterRedirect}
                        className="create-button"
                      >
                        📝 Registrarse
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Mensaje de estado no pendiente */}
            {(invitation.status !== "pending" || isExpired) && (
              <div className="status-message-container">
                {isExpired ? (
                  <p className="status-message warning">
                    ⚠️ Esta invitación ha expirado y ya no puede ser aceptada.
                  </p>
                ) : invitation.status === "accepted" ? (
                  <p className="status-message success">
                    ✅ Esta invitación ya ha sido aceptada. Ahora eres
                    colaborador del diagrama.
                  </p>
                ) : invitation.status === "rejected" ? (
                  <p className="status-message error">
                    ❌ Esta invitación fue rechazada.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default InvitationPage;
