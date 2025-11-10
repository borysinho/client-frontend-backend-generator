import { useCallback } from "react";
import type { CustomElement, UMLRelationship } from "../types";

interface UseElementDeleterProps {
  trackElementRemove: (elementId: string, elementName: string) => void;
  trackRelationshipRemove: (relationshipId: string) => void;
  addNotification: (
    type: "success" | "error" | "info" | "warning",
    title: string,
    message: string,
    autoClose?: boolean,
    duration?: number
  ) => void;
  setSelectedElement: (element: CustomElement | UMLRelationship | null) => void;
  handleSaveDiagram: (isAutoSave?: boolean) => void;
}

export const useElementDeleter = ({
  trackElementRemove,
  trackRelationshipRemove,
  addNotification,
  setSelectedElement,
  handleSaveDiagram,
}: UseElementDeleterProps) => {
  const handleDeleteElement = useCallback(
    (elementToDelete: CustomElement | UMLRelationship) => {
      if ("className" in elementToDelete) {
        // Es un CustomElement

        // ✅ MVC: Mostrar indicador de procesamiento
        addNotification(
          "info",
          "Procesando...",
          `Eliminando "${elementToDelete.className}"...`,
          true,
          2000
        );

        // ❌ MVC: NO eliminar directamente del estado
        // setDynamicElements((prev) =>
        //   prev.filter((el) => el.id !== elementToDelete.id)
        // );

        // ✅ MVC: SOLO trackear la eliminación, el servidor lo confirmará
        trackElementRemove(
          elementToDelete.id,
          elementToDelete.className || "Elemento"
        );

        // ❌ MVC: NO actualizar el padre directamente
        // if (elementToDelete.parentPackageId) {
        //   setDynamicElements(...)
        // }
      } else {
        // Es un UMLRelationship

        // ✅ MVC: Mostrar indicador de procesamiento
        addNotification(
          "info",
          "Procesando...",
          "Eliminando relación...",
          true,
          2000
        );

        // ❌ MVC: NO eliminar directamente del estado
        // setDynamicLinks((prev) =>
        //   prev.filter((rel) => rel.id !== elementToDelete.id)
        // );

        // ✅ MVC: SOLO trackear la eliminación
        trackRelationshipRemove(elementToDelete.id);
      }

      // ✅ Deseleccionar inmediatamente (no afecta datos del modelo)
      setSelectedElement(null);

      // ✅ Auto-guardar el diagrama después de la eliminación
      handleSaveDiagram(true); // true indica auto-guardado silencioso

      console.log("📤 Operación de eliminación enviada al servidor");
    },
    [
      trackElementRemove,
      trackRelationshipRemove,
      addNotification,
      setSelectedElement,
      handleSaveDiagram,
    ]
  );

  return {
    handleDeleteElement,
  };
};
