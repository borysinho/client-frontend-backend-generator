import type { JsonPatchOperation } from "../types";

export interface AIRequest {
  action: "generate_diagram" | "generate_from_image";
  prompt: string;
  context?: {
    existingClasses?: string[];
    diagramElements?: Record<string, unknown>[];
    diagramRelationships?: Record<string, unknown>[];
  };
  clientId: string;
  // Nuevo: soporte para imágenes (base64)
  image?: string; // Base64 encoded image data (formato: data:image/png;base64,...)
}

export interface DiagramDelta {
  // Agregar nuevos elementos y relaciones
  newElements: unknown[];
  newRelationships: unknown[];

  // Eliminar elementos y relaciones por ID
  removeElementIds?: string[];
  removeRelationshipIds?: string[];

  // Modificar elementos y relaciones existentes (actualización parcial)
  updateElements?: Array<{
    id: string;
    changes: Record<string, unknown>;
  }>;
  updateRelationships?: Array<{
    id: string;
    changes: Record<string, unknown>;
  }>;
}

export interface AIResponse {
  success: boolean;
  delta?: DiagramDelta;
  operations?: JsonPatchOperation[]; // Deprecado
  error?: string;
}

export class AIService {
  private baseUrl: string;

  constructor() {
    // Protecciones extras: Vite inyecta variables en tiempo de compilación.
    // Asegurarse de no usar la cadena literal "undefined" ni cadena vacía.
    const envUrl = import.meta.env.VITE_API_URL as string | undefined;
    this.baseUrl =
      envUrl && envUrl !== "undefined" ? envUrl : "http://localhost:3001";
  }

  async generateDiagram(
    prompt: string,
    existingClasses?: string[],
    currentElements?: Record<string, unknown>[],
    currentRelationships?: Record<string, unknown>[]
  ): Promise<AIResponse> {
    const clientId = `client-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    return this.processRequest({
      action: "generate_diagram",
      prompt,
      context: {
        existingClasses,
        diagramElements: currentElements,
        diagramRelationships: currentRelationships,
      },
      clientId,
    });
  }

  async generateFromImage(
    image: string,
    prompt?: string,
    existingClasses?: string[],
    currentElements?: Record<string, unknown>[],
    currentRelationships?: Record<string, unknown>[]
  ): Promise<AIResponse> {
    const clientId = `client-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    return this.processRequest({
      action: "generate_from_image",
      prompt:
        prompt ||
        "Analiza esta imagen y genera un diagrama UML con todas las clases, atributos, métodos y relaciones que puedas identificar.",
      image,
      context: {
        existingClasses,
        diagramElements: currentElements,
        diagramRelationships: currentRelationships,
      },
      clientId,
    });
  }

  private async processRequest(request: AIRequest): Promise<AIResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/ai/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: AIResponse = await response.json();
      return data;
    } catch (error) {
      console.error("Error calling AI service:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }
}
