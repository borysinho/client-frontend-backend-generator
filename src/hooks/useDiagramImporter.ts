import { useCallback } from "react";
import type { CustomElement, UMLRelationship } from "../types";

interface UseDiagramImporterProps {
  setDynamicElements: (elements: any[]) => void;
  setDynamicLinks: (links: any[]) => void;
  addNotification: (
    type: "success" | "error" | "warning" | "info",
    title: string,
    message: string,
    persistent?: boolean,
    duration?: number
  ) => void;
  // Funciones de sincronización colaborativa
  trackElementAdd?: (element: CustomElement) => void;
  trackRelationshipAdd?: (relationship: UMLRelationship) => void;
}

export const useDiagramImporter = ({
  setDynamicElements,
  setDynamicLinks,
  addNotification,
  trackElementAdd,
  trackRelationshipAdd,
}: UseDiagramImporterProps) => {
  const handleImport = useCallback(() => {
    try {
      // Crear input file oculto
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,application/json";
      input.style.display = "none";

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          return;
        }

        try {
          // Leer el archivo
          const text = await file.text();
          const importedData = JSON.parse(text);

          // El servidor exporta con estructura: { name, state: { elements, relationships } }
          // Extraer los datos desde 'state' si está presente
          const diagramState = importedData.state || importedData;
          let elements = diagramState.elements || [];
          let relationships = diagramState.relationships || [];
          const name = importedData.name || "Diagrama Importado";

          // Convertir objetos a arrays si es necesario
          // El servidor exporta elements y relationships como objetos con IDs como keys
          if (!Array.isArray(elements) && typeof elements === "object") {
            elements = Object.values(elements);
          }
          if (
            !Array.isArray(relationships) &&
            typeof relationships === "object"
          ) {
            relationships = Object.values(relationships);
          }

          // Validar estructura básica
          if (!Array.isArray(elements)) {
            throw new Error(
              "Formato de archivo inválido. El archivo no contiene elementos válidos."
            );
          }

          // Cargar los elementos y relaciones
          // Si estamos en modo colaborativo, usar las funciones de tracking
          if (trackElementAdd && trackRelationshipAdd) {
            console.log("📡 Importando en modo colaborativo...");
            // Limpiar elementos y relaciones existentes primero
            setDynamicElements([]);
            setDynamicLinks([]);

            // Agregar elementos uno por uno usando tracking colaborativo
            elements.forEach((element) => {
              trackElementAdd(element);
            });

            // Agregar relaciones una por una usando tracking colaborativo
            relationships.forEach((relationship: UMLRelationship) => {
              trackRelationshipAdd(relationship);
            });
          } else {
            // Modo single-user: actualizar estado directamente
            console.log("👤 Importando en modo single-user...");
            setDynamicElements(elements);
            setDynamicLinks(relationships);
          }

          // No cambiar el nombre del diagrama actual, solo importar el contenido
          // setDiagramName(name); // ← Comentado para mantener el nombre actual

          addNotification(
            "success",
            "Importación Completada",
            `Se han importado ${elements.length} elementos desde "${name}".`,
            true,
            5000
          );

          console.log("Diagrama importado:", {
            name: name,
            elements: elements.length,
            relationships: relationships.length,
          });
        } catch (error) {
          console.error("Error al procesar el archivo:", error);
          addNotification(
            "error",
            "Error de Importación",
            error instanceof Error
              ? error.message
              : "El archivo no tiene un formato JSON válido.",
            true,
            8000
          );
        } finally {
          // Limpiar el input
          document.body.removeChild(input);
        }
      };

      // Agregar al DOM y hacer clic
      document.body.appendChild(input);
      input.click();
    } catch (error) {
      console.error("Error al importar:", error);
      addNotification(
        "error",
        "Error de Importación",
        "No se pudo iniciar el proceso de importación.",
        true,
        8000
      );
    }
  }, [
    addNotification,
    setDynamicElements,
    setDynamicLinks,
    trackElementAdd,
    trackRelationshipAdd,
  ]);

  return {
    handleImport,
  };
};
