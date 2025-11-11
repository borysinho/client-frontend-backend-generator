import { useCallback } from "react";
import type { CustomElement, UMLRelationship } from "../types";
import { API_CONFIG } from "../utils/apiConfig";

interface UseDiagramSaverResult {
  handleSaveDiagram: (isAutoSave?: boolean) => Promise<void>;
}

interface UseDiagramSaverProps {
  diagramName: string;
  currentDiagramId: string | null;
  setCurrentDiagramId: (id: string | null) => void;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  dynamicElementsRef: React.RefObject<CustomElement[]>;
  dynamicLinksRef: React.RefObject<UMLRelationship[]>;
  addNotification: (
    type: "success" | "error" | "warning" | "info",
    title: string,
    message: string,
    persistent?: boolean,
    duration?: number
  ) => void;
}

export function useDiagramSaver({
  diagramName,
  currentDiagramId,
  setCurrentDiagramId,
  setHasUnsavedChanges,
  dynamicElementsRef,
  dynamicLinksRef,
  addNotification,
}: UseDiagramSaverProps): UseDiagramSaverResult {
  const handleSaveDiagram = useCallback(
    async (isAutoSave = false) => {
      try {
        const userStr = localStorage.getItem("user");
        if (!userStr) {
          addNotification(
            "error",
            "Error de Autenticación",
            "No se encontró información del usuario. Por favor, inicia sesión nuevamente.",
            true,
            8000
          );
          return;
        }

        const user = JSON.parse(userStr);

        if (!diagramName) {
          addNotification(
            "error",
            "Nombre del Diagrama Requerido",
            "El diagrama debe tener un nombre para poder guardarse.",
            true,
            8000
          );
          return;
        }

        // Construir el estado del diagrama
        const diagramState = {
          elements: {} as Record<string, CustomElement>,
          relationships: {} as Record<string, UMLRelationship>,
          version: 1,
          lastModified: Date.now(),
        };

        // ✅ Usar refs para obtener el estado MÁS RECIENTE (evita closures stale)
        const currentDynamicElements = dynamicElementsRef.current || [];
        const currentDynamicLinks = dynamicLinksRef.current || [];

        console.log(
          "📊 Estado a guardar - Elementos:",
          currentDynamicElements.length
        );
        console.log(
          "📊 IDs de elementos:",
          currentDynamicElements.map((el) => el.id)
        );
        console.log(
          "📊 Detalles de elementos:",
          currentDynamicElements.map((el) => ({
            id: el.id,
            name: el.className,
          }))
        );

        // Agregar elementos al estado
        const initialElements: CustomElement[] = []; // Este debería venir como parámetro si es necesario
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

        // Preparar los datos para enviar
        const isUpdate = !!currentDiagramId;
        const diagramData = {
          diagramId: currentDiagramId || `diagram-${Date.now()}-${user.id}`,
          name: diagramName,
          description: `Diagrama UML creado por ${user.name || user.email}`,
          creatorId: user.id,
          collaborators: [],
          state: diagramState,
          isPublic: false,
          tags: [],
        };

        console.log(
          `${isUpdate ? "Actualizando" : "Guardando"} diagrama:`,
          diagramData
        );
        console.log(
          `📊 Estado a guardar - Elementos:`,
          Object.keys(diagramState.elements).length
        );
        console.log(`📊 IDs de elementos:`, Object.keys(diagramState.elements));
        console.log(
          `📊 Detalles de elementos:`,
          Object.values(diagramState.elements).map((e) => ({
            id: e.id,
            className: e.className,
          }))
        );

        // Enviar a la API
        const url = isUpdate
          ? `${API_CONFIG.BASE_URL}/api/diagrams/${currentDiagramId}`
          : `${API_CONFIG.BASE_URL}/api/diagrams`;
        const method = isUpdate ? "PUT" : "POST";
        const response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(diagramData),
        });

        if (response.ok) {
          const savedDiagram = await response.json();
          console.log("Diagrama guardado exitosamente:", savedDiagram);

          // Si es creación, actualizar el currentDiagramId
          if (!isUpdate) {
            setCurrentDiagramId(savedDiagram.diagramId);
          }

          // Marcar que no hay cambios pendientes
          setHasUnsavedChanges(false);

          // Solo mostrar notificación si no es auto-guardado
          if (!isAutoSave) {
            addNotification(
              "success",
              "Diagrama Guardado",
              `El diagrama "${diagramName}" se ha guardado exitosamente.`,
              true,
              3000
            );
          }
        } else {
          const errorText = await response.text();
          console.error(
            "Error al guardar diagrama:",
            response.status,
            errorText
          );

          // Solo mostrar notificación de error si no es auto-guardado
          if (!isAutoSave) {
            addNotification(
              "error",
              "Error al Guardar",
              `No se pudo guardar el diagrama. Error: ${errorText}`,
              true,
              8000
            );
          }
        }
      } catch (error) {
        console.error("Error inesperado al guardar diagrama:", error);

        // Solo mostrar notificación de error si no es auto-guardado
        if (!isAutoSave) {
          addNotification(
            "error",
            "Error Inesperado",
            "Ocurrió un error inesperado al guardar el diagrama. Por favor, inténtalo de nuevo.",
            true,
            8000
          );
        }
      }
    },
    [
      diagramName,
      addNotification,
      currentDiagramId,
      setCurrentDiagramId,
      setHasUnsavedChanges,
      dynamicElementsRef,
      dynamicLinksRef,
    ]
  );

  return {
    handleSaveDiagram,
  };
}
