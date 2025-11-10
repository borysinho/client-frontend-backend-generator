import { useState, useCallback } from "react";
import type { CustomElement, UMLRelationship } from "../types";
import { truncateText } from "../utils/textUtils";

interface UseRelationshipHandlerResult {
  relationshipMode: string | null;
  setRelationshipMode: (mode: string | null) => void;
  firstSelectedElement: CustomElement | null;
  setFirstSelectedElement: (element: CustomElement | null) => void;
  handleRelationshipSelection: (
    element: CustomElement | UMLRelationship | null,
    trackRelationshipAdd: (relationship: UMLRelationship) => void,
    addNotification: (
      type: "success" | "error" | "warning" | "info",
      title: string,
      message: string,
      persistent?: boolean,
      duration?: number
    ) => void,
    setSelectedElement: (
      element: CustomElement | UMLRelationship | null
    ) => void
  ) => void;
}

export function useRelationshipHandler(): UseRelationshipHandlerResult {
  const [relationshipMode, setRelationshipMode] = useState<string | null>(null);
  const [firstSelectedElement, setFirstSelectedElement] =
    useState<CustomElement | null>(null);

  const handleRelationshipSelection = useCallback(
    (
      element: CustomElement | UMLRelationship | null,
      trackRelationshipAdd: (relationship: UMLRelationship) => void,
      addNotification: (
        type: "success" | "error" | "warning" | "info",
        title: string,
        message: string,
        persistent?: boolean,
        duration?: number
      ) => void,
      setSelectedElement: (
        element: CustomElement | UMLRelationship | null
      ) => void
    ) => {
      if (element) {
        if (relationshipMode) {
          // Si estamos en modo relación y se hace click en un elemento, manejar la lógica de relación
          if ("className" in element) {
            // Es un CustomElement
            if (!firstSelectedElement) {
              // Seleccionar primer elemento
              setFirstSelectedElement(element);
              console.log(
                "First element selected for relationship:",
                element.className
              );
            } else if (firstSelectedElement.id !== element.id) {
              // Seleccionar segundo elemento y crear relación
              const fullLabel = relationshipMode;

              // Establecer multiplicidades por defecto según el tipo de relación
              let defaultSourceMultiplicity = "1";
              let defaultTargetMultiplicity = "1";

              // Configurar multiplicidades según el tipo de relación
              switch (relationshipMode) {
                case "association":
                  defaultSourceMultiplicity = "0..*";
                  defaultTargetMultiplicity = "0..*";
                  break;
                case "aggregation":
                  defaultSourceMultiplicity = "1";
                  defaultTargetMultiplicity = "0..*";
                  break;
                case "composition":
                  defaultSourceMultiplicity = "1";
                  defaultTargetMultiplicity = "1..*";
                  break;
                case "generalization":
                case "realization":
                case "dependency":
                  // Estas relaciones no usan multiplicidad
                  defaultSourceMultiplicity = "";
                  defaultTargetMultiplicity = "";
                  break;
              }

              const newRelationship: UMLRelationship = {
                id: `link-${Date.now()}`,
                source: firstSelectedElement.id,
                target: element.id,
                relationship:
                  relationshipMode as UMLRelationship["relationship"],
                label: truncateText(fullLabel, 10), // Texto truncado para visualización
                fullLabel: fullLabel, // Texto completo para propiedades
                sourceMultiplicity: defaultSourceMultiplicity,
                targetMultiplicity: defaultTargetMultiplicity,
              };

              // ✅ MVC: SOLO trackear la creación de la relación
              trackRelationshipAdd(newRelationship);

              // ✅ MVC: Mostrar indicador
              addNotification(
                "info",
                "Procesando...",
                "Creando relación...",
                true,
                2000
              );

              console.log("Relationship operation sent:", newRelationship);

              // Resetear modo de relación
              setRelationshipMode(null);
              setFirstSelectedElement(null);
            }
          }
        } else {
          // Modo normal - seleccionar elemento o relación para edición
          setSelectedElement(element);
        }
      } else {
        // Deseleccionar elemento
        setSelectedElement(null);
      }
    },
    [relationshipMode, firstSelectedElement]
  );

  return {
    relationshipMode,
    setRelationshipMode,
    firstSelectedElement,
    setFirstSelectedElement,
    handleRelationshipSelection,
  };
}
