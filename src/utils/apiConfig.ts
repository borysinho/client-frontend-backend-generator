// Configuración centralizada para URLs de API
export const API_CONFIG = {
  // URL base del backend - usa variable de entorno o detecta automáticamente el entorno
  BASE_URL: (() => {
    // Primero intenta usar la variable de entorno
    if (import.meta.env.VITE_API_URL) {
      return import.meta.env.VITE_API_URL;
    }

    // Si estamos en producción (GitHub Pages), usa la URL de Vercel
    if (typeof window !== 'undefined' && window.location.hostname === 'borysinho.github.io') {
      return 'https://server-frontend-backend-generator.vercel.app';
    }

    // Fallback para desarrollo local
    return "http://localhost:3001";
  })(),

  // Endpoints de la API
  ENDPOINTS: {
    // Diagramas
    DIAGRAMS: "/api/diagrams",
    DIAGRAM_GENERATE_BACKEND: "/api/diagrams/generate-backend",
    DIAGRAM_EXPORT: "/api/diagrams/export",

    // Snapshots
    SNAPSHOTS: "/api/snapshots",

    // Invitaciones
    INVITATIONS: "/api/invitations",

    // AI
    AI_GENERATE: "/api/ai/generate",

    // Health check
    HEALTH: "/api/health",
  },
};

// Función helper para construir URLs completas
export const buildApiUrl = (endpoint: string): string => {
  const baseUrl = API_CONFIG.BASE_URL;
  // Remover barra inicial del endpoint si existe para evitar doble barra
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
};

// Función helper para hacer fetch con la URL base correcta
export const apiFetch = async (
  endpoint: string,
  options?: RequestInit
): Promise<Response> => {
  const url = buildApiUrl(endpoint);
  return fetch(url, options);
};
