import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./css/Dashboard.css";

interface Diagram {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  collaborators: number;
  userRole: "creator" | "collaborator";
}

interface BackendDiagram {
  diagramId: string;
  name: string;
  description?: string;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  collaborators?: string[];
}

const Dashboard: React.FC = () => {
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingInvitationsCount, setPendingInvitationsCount] = useState(0);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Verificar si el usuario está autenticado
    const user = localStorage.getItem("user");
    if (!user) {
      navigate("/login");
      return;
    }

    // Cargar datos del dashboard
    loadDashboardData();
  }, [navigate]);

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".diagram-menu-container")) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [openMenuId]);

  const loadDashboardData = async () => {
    try {
      const userStr = localStorage.getItem("user");
      if (!userStr) return;

      const user = JSON.parse(userStr);

      // Cargar diagramas reales desde el backend
      const diagramsResponse = await fetch(`/api/diagrams/user/${user.id}`);
      if (diagramsResponse.ok) {
        try {
          const diagramsData = await diagramsResponse.json();
          // Transformar los datos del backend al formato esperado por el frontend
          const transformedDiagrams: Diagram[] = diagramsData.map(
            (diagram: BackendDiagram) => ({
              id: diagram.diagramId,
              name: diagram.name,
              description: diagram.description || "Sin descripción",
              createdAt: new Date(diagram.createdAt).toLocaleDateString(),
              updatedAt: new Date(diagram.updatedAt).toLocaleDateString(),
              collaborators: diagram.collaborators?.length || 0,
              userRole:
                diagram.creatorId === user.id ? "creator" : "collaborator",
            })
          );
          setDiagrams(transformedDiagrams);
        } catch (error) {
          console.error("Error parsing diagrams response:", error);
          setDiagrams([]);
        }
      } else {
        console.error(`Failed to load diagrams: HTTP ${diagramsResponse.status}`);
        setDiagrams([]);
      }

      // Cargar conteo de invitaciones pendientes para el indicador
      const invitationsResponse = await fetch("/api/invitations", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (invitationsResponse.ok) {
        const invitationsData = await invitationsResponse.json();
        // Contar solo las invitaciones pendientes para el usuario actual
        const pendingCount = invitationsData.filter(
          (invitation: { inviteeEmail: string; status: string }) =>
            invitation.inviteeEmail === user.email &&
            invitation.status === "pending"
        ).length;
        setPendingInvitationsCount(pendingCount);
      } else {
        setPendingInvitationsCount(0);
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      setPendingInvitationsCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateDiagram = async () => {
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      navigate("/login");
      return;
    }

    const user = JSON.parse(userStr);

    // Pedir el nombre del diagrama
    let diagramName = prompt("Ingresa el nombre del diagrama:");

    if (!diagramName || diagramName.trim() === "") {
      alert("El nombre del diagrama es obligatorio");
      return;
    }

    diagramName = diagramName.trim();

    try {
      // Verificar si el nombre ya existe para este usuario
      console.log("Verificando nombre:", diagramName, "para usuario:", user.id);
      const response = await fetch(
        `/api/diagrams/check-name?name=${encodeURIComponent(
          diagramName
        )}&creatorId=${encodeURIComponent(user.id)}`
      );
      console.log("Respuesta de la API:", response.status, response.ok);

      if (response.ok) {
        const data = await response.json();
        console.log("Datos de la API:", data);
        const { exists } = data;
        if (exists) {
          alert(
            `Ya tienes un diagrama con el nombre "${diagramName}". Por favor elige un nombre diferente.`
          );
          return;
        }
      } else {
        const errorText = await response.text();
        console.error("Error en respuesta de API:", response.status, errorText);
        alert("Error al verificar el nombre del diagrama");
        return;
      }

      // Generar ID único para el diagrama
      const diagramId = `diagram-${Date.now()}-${user.id}`;

      // Crear diagrama vacío en la base de datos
      const createResponse = await fetch("/api/diagrams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          diagramId,
          name: diagramName,
          description: `Diagrama UML creado por ${user.name || user.email}`,
          creatorId: user.id,
          collaborators: [],
          state: {
            elements: {},
            relationships: {},
            version: 1,
            lastModified: new Date().toISOString(),
          },
          isPublic: false,
          tags: [],
        }),
      });

      if (createResponse.ok) {
        const savedDiagram = await createResponse.json();
        console.log("Diagrama creado exitosamente:", savedDiagram);

        // Navegar al editor con el diagramId
        navigate(`/diagrams/${diagramId}`);
      } else {
        const errorText = await createResponse.text();
        console.error(
          "Error creando diagrama:",
          createResponse.status,
          errorText
        );
        alert("Error al crear el diagrama");
      }
    } catch (error) {
      console.error("Error creando diagrama:", error);
      alert("Error al crear el diagrama");
    }
  };

  const handleDeleteDiagram = async (diagramId: string) => {
    // Confirmar eliminación
    const confirmDelete = window.confirm(
      "¿Estás seguro de que quieres eliminar este diagrama? Esta acción no se puede deshacer."
    );

    if (confirmDelete) {
      try {
        const response = await fetch(`/api/diagrams/${diagramId}`, {
          method: "DELETE",
        });

        if (response.ok) {
          // Eliminar del estado local después de eliminar exitosamente del backend
          setDiagrams((prev) =>
            prev.filter((diagram) => diagram.id !== diagramId)
          );
          console.log(`Diagrama ${diagramId} eliminado exitosamente`);
        } else {
          console.error("Error al eliminar el diagrama:", response.statusText);
          alert(
            "Error al eliminar el diagrama. Por favor, inténtalo de nuevo."
          );
        }
      } catch (error) {
        console.error("Error al eliminar el diagrama:", error);
        alert("Error al eliminar el diagrama. Por favor, inténtalo de nuevo.");
      }
    }
  };

  const handleShareDiagram = async (diagramId: string) => {
    try {
      const userStr = localStorage.getItem("user");
      if (!userStr) return;

      const user = JSON.parse(userStr);

      // Pedir email del invitado
      const inviteeEmail = prompt(
        "Ingresa el email de la persona que quieres invitar:"
      );
      if (!inviteeEmail) return;

      // Pedir mensaje opcional
      const message = prompt("Mensaje opcional para la invitación:");

      // Crear invitación
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Expira en 7 días

      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          diagramId,
          creatorId: user.id,
          inviteeEmail,
          message: message || undefined,
          expiresAt: expiresAt.toISOString(),
        }),
      });

      if (response.ok) {
        alert("Invitación enviada exitosamente!");
        // Recargar datos para mostrar la nueva invitación
        await loadDashboardData();
      } else {
        let errorMessage = "Error desconocido";
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const error = await response.json();
            errorMessage = error.message || errorMessage;
          } else {
            errorMessage = `Error HTTP ${response.status}: ${response.statusText}`;
          }
        } catch {
          errorMessage = `Error HTTP ${response.status}: ${response.statusText}`;
        }
        alert(`Error al enviar invitación: ${errorMessage}`);
      }
    } catch (error) {
      console.error("Error sharing diagram:", error);
      alert("Error al enviar la invitación");
    }
  };

  const toggleMenu = (diagramId: string) => {
    setOpenMenuId(openMenuId === diagramId ? null : diagramId);
  };

  const handleEditName = async (diagram: Diagram) => {
    const newName = prompt(
      "Ingresa el nuevo nombre del diagrama:",
      diagram.name
    );
    if (!newName || newName === diagram.name) return;

    try {
      // Obtener el diagrama completo del servidor
      const getResponse = await fetch(`/api/diagrams/${diagram.id}`);
      if (!getResponse.ok) {
        alert("Error al obtener el diagrama");
        return;
      }

      const fullDiagram = await getResponse.json();

      // Actualizar solo el nombre
      const response = await fetch(`/api/diagrams/${diagram.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...fullDiagram,
          name: newName,
        }),
      });

      if (response.ok) {
        // Actualizar diagrama en el estado local
        setDiagrams((prev) =>
          prev.map((d) => (d.id === diagram.id ? { ...d, name: newName } : d))
        );
        setOpenMenuId(null);
        alert("Nombre actualizado correctamente");
      } else {
        alert("Error al actualizar el nombre");
      }
    } catch (error) {
      console.error("Error updating diagram name:", error);
      alert("Error al actualizar el nombre");
    }
  };

  const handleEditDescription = async (diagram: Diagram) => {
    const newDescription = prompt(
      "Ingresa la nueva descripción del diagrama:",
      diagram.description
    );
    if (newDescription === null || newDescription === diagram.description)
      return;

    try {
      // Obtener el diagrama completo del servidor
      const getResponse = await fetch(`/api/diagrams/${diagram.id}`);
      if (!getResponse.ok) {
        alert("Error al obtener el diagrama");
        return;
      }

      const fullDiagram = await getResponse.json();

      // Actualizar solo la descripción
      const response = await fetch(`/api/diagrams/${diagram.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...fullDiagram,
          description: newDescription,
        }),
      });

      if (response.ok) {
        // Actualizar diagrama en el estado local
        setDiagrams((prev) =>
          prev.map((d) =>
            d.id === diagram.id ? { ...d, description: newDescription } : d
          )
        );
        setOpenMenuId(null);
        alert("Descripción actualizada correctamente");
      } else {
        alert("Error al actualizar la descripción");
      }
    } catch (error) {
      console.error("Error updating diagram description:", error);
      alert("Error al actualizar la descripción");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  if (isLoading) {
    return (
      <div className="dashboard-container">
        <div className="loading">Cargando dashboard...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Dashboard</h1>
          <div className="header-actions">
            <Link to="/invitations" className="invitations-link">
              Invitaciones
              {pendingInvitationsCount > 0 && (
                <span className="invitations-badge">
                  {pendingInvitationsCount}
                </span>
              )}
            </Link>
            <button onClick={handleCreateDiagram} className="create-button">
              Nuevo Diagrama
            </button>
            <button onClick={handleLogout} className="logout-button">
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        {/* Sección de Mis Diagramas (creados por el usuario) */}
        <section className="diagrams-section">
          <h2>📐 Mis Diagramas</h2>
          {diagrams.filter((d) => d.userRole === "creator").length === 0 ? (
            <div className="empty-state">
              <p>No tienes diagramas creados aún.</p>
              <button onClick={handleCreateDiagram} className="create-button">
                Crear tu primer diagrama
              </button>
            </div>
          ) : (
            <div className="diagrams-grid">
              {diagrams
                .filter((diagram) => diagram.userRole === "creator")
                .map((diagram) => (
                  <div
                    key={diagram.id}
                    className="diagram-card"
                    onClick={(e) => {
                      // No navegar si se hizo clic en el menú
                      if (
                        !(e.target as HTMLElement).closest(
                          ".diagram-menu-container"
                        )
                      ) {
                        navigate(`/diagrams/${diagram.id}`);
                      }
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="diagram-header">
                      <h3>{diagram.name}</h3>
                      <div className="diagram-header-actions">
                        <div className="diagram-badges">
                          <span className="user-role creator">👑 Creador</span>
                          <span className="collaborators">
                            👥 {diagram.collaborators}
                          </span>
                        </div>
                        <div className="diagram-menu-container">
                          <button
                            className="diagram-menu-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMenu(diagram.id);
                            }}
                            title="Más opciones"
                          >
                            ⋮
                          </button>
                          {openMenuId === diagram.id && (
                            <div className="diagram-dropdown-menu">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditName(diagram);
                                }}
                                className="menu-item"
                              >
                                ✏️ Editar nombre
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditDescription(diagram);
                                }}
                                className="menu-item"
                              >
                                📝 Editar descripción
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleShareDiagram(diagram.id);
                                  setOpenMenuId(null);
                                }}
                                className="menu-item"
                              >
                                📤 Compartir
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteDiagram(diagram.id);
                                  setOpenMenuId(null);
                                }}
                                className="menu-item delete"
                              >
                                🗑️ Eliminar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="diagram-description">{diagram.description}</p>
                    <div className="diagram-meta">
                      <span>Creado: {diagram.createdAt}</span>
                      <span>Actualizado: {diagram.updatedAt}</span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>

        {/* Sección de Diagramas Colaborativos */}
        {diagrams.filter((d) => d.userRole === "collaborator").length > 0 && (
          <section className="diagrams-section collaborations-section">
            <h2>🤝 Colaboraciones</h2>
            <div className="diagrams-grid">
              {diagrams
                .filter((diagram) => diagram.userRole === "collaborator")
                .map((diagram) => (
                  <div
                    key={diagram.id}
                    className="diagram-card collaboration-card"
                    onClick={() => navigate(`/diagrams/${diagram.id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="diagram-header">
                      <h3>{diagram.name}</h3>
                      <div className="diagram-badges">
                        <span className="user-role collaborator">
                          🤝 Colaborador
                        </span>
                        <span className="collaborators">
                          👥 {diagram.collaborators}
                        </span>
                      </div>
                    </div>
                    <p className="diagram-description">{diagram.description}</p>
                    <div className="diagram-meta">
                      <span>Creado: {diagram.createdAt}</span>
                      <span>Actualizado: {diagram.updatedAt}</span>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
