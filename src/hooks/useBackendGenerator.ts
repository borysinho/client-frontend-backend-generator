import { useCallback } from "react";
import type { CustomElement, UMLRelationship } from "../types";
import { API_CONFIG } from "../utils/apiConfig";

interface DatabaseConfig {
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  schema?: string;
}

interface UseBackendGeneratorProps {
  setIsDatabaseConfigModalOpen: (open: boolean) => void;
  addNotification: (
    type: "success" | "error" | "warning" | "info",
    title: string,
    message: string,
    persistent?: boolean,
    duration?: number
  ) => void;
  dynamicElementsRef: React.MutableRefObject<CustomElement[]>;
  dynamicLinksRef: React.MutableRefObject<UMLRelationship[]>;
  initialElements: CustomElement[];
  diagramName?: string;
  currentDiagramId?: string | null;
}

export const useBackendGenerator = ({
  setIsDatabaseConfigModalOpen,
  addNotification,
  dynamicElementsRef,
  dynamicLinksRef,
  initialElements,
  diagramName,
  currentDiagramId,
}: UseBackendGeneratorProps) => {
  const handleConfirmBackendGeneration = useCallback(
    async (dbConfig: DatabaseConfig) => {
      try {
        setIsDatabaseConfigModalOpen(false);

        addNotification(
          "info",
          "Generando Backend",
          "1/3: Transformando diagrama a modelo físico...",
          true,
          3000
        );

        // Construir el estado del diagrama
        const diagramState = {
          elements: {} as Record<string, CustomElement>,
          relationships: {} as Record<string, UMLRelationship>,
          version: 1,
          lastModified: Date.now(),
        };

        // ✅ Usar refs para obtener el estado MÁS RECIENTE (evita closures stale)
        const currentDynamicElements = dynamicElementsRef.current;
        const currentDynamicLinks = dynamicLinksRef.current;

        // Agregar elementos al estado
        [...initialElements, ...currentDynamicElements].forEach((element) => {
          diagramState.elements[element.id] = {
            id: element.id,
            className: element.className,
            attributes: element.attributes || [],
            methods: element.methods || [],
            elementType: element.elementType,
            stereotype: element.stereotype,
            parentPackageId: element.parentPackageId,
            containedElements: element.containedElements || [],
            x: element.x,
            y: element.y,
            width: element.width,
            height: element.height,
          };
        });

        // Agregar relaciones al estado
        currentDynamicLinks.forEach((relationship) => {
          diagramState.relationships[relationship.id] = {
            id: relationship.id,
            source: relationship.source,
            target: relationship.target,
            relationship: relationship.relationship,
            label: relationship.label,
            sourceMultiplicity: relationship.sourceMultiplicity,
            targetMultiplicity: relationship.targetMultiplicity,
            sourceRole: relationship.sourceRole,
            targetRole: relationship.targetRole,
          };
        });

        // Obtener información del usuario
        const userStr = localStorage.getItem("user");
        const user = userStr ? JSON.parse(userStr) : null;

        // Enviar el diagrama al servidor para transformación y generación
        addNotification(
          "info",
          "Generando Backend",
          "2/3: Gestionando base de datos y aplicando migraciones...",
          true,
          5000
        );

        const response = await fetch(
          `${API_CONFIG.BASE_URL}/api/diagrams/generate-backend`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              diagramState,
              diagramName: diagramName || "generated-backend",
              databaseConfig: dbConfig,
              diagramId: currentDiagramId, // ✅ Agregar diagramId para guardar snapshot
              creatorId: user?.id, // ✅ Agregar creatorId para guardar snapshot
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Error del servidor: ${response.status}`
          );
        }

        addNotification(
          "info",
          "Generando Backend",
          "3/3: Generando código Spring Boot...",
          true,
          3000
        );

        // El servidor devuelve un archivo ZIP directamente
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const linkElement = document.createElement("a");
        linkElement.href = url;
        linkElement.download = `${diagramName || "backend"}.zip`;
        document.body.appendChild(linkElement);
        linkElement.click();
        document.body.removeChild(linkElement);
        window.URL.revokeObjectURL(url);

        addNotification(
          "success",
          "Backend Generado",
          `El backend Spring Boot "${
            diagramName || "backend"
          }.zip" se ha descargado exitosamente.`,
          true,
          5000
        );
      } catch (error) {
        console.error("Error al generar backend:", error);
        addNotification(
          "error",
          "Error en Generación",
          `No se pudo generar el backend: ${
            error instanceof Error ? error.message : "Error desconocido"
          }`,
          true,
          8000
        );
      }
    },
    [
      setIsDatabaseConfigModalOpen,
      addNotification,
      dynamicElementsRef,
      dynamicLinksRef,
      initialElements,
      diagramName,
      currentDiagramId,
    ]
  );

  return {
    handleConfirmBackendGeneration,
  };
};
