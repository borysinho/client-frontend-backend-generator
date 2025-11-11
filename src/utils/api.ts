/**
 * Utilidades para llamadas API centralizadas
 * Todas las llamadas API deben usar esta función para asegurar consistencia
 */

// Obtener la URL base de la API desde variables de entorno
export const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  // Protecciones extras: evitar usar "undefined" como URL
  return envUrl && envUrl !== "undefined" ? envUrl : "http://localhost:3001";
};

// Función centralizada para construir URLs de API
export const buildApiUrl = (endpoint: string): string => {
  const baseUrl = getApiBaseUrl();
  // Asegurar que el endpoint comience con /
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
};

// Función helper para hacer fetch con la URL correcta
export const apiFetch = async (
  endpoint: string,
  options?: RequestInit
): Promise<Response> => {
  const url = buildApiUrl(endpoint);
  console.log(`API Call: ${options?.method || "GET"} ${url}`);
  return fetch(url, options);
};
