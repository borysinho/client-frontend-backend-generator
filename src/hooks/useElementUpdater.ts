import { useCallback } from "react";
import type { CustomElement } from "../types";

interface UseElementUpdaterProps {
  dynamicElements: CustomElement[];
  trackElementUpdate: (
    elementId: string,
    elementName: string,
    changes: Partial<CustomElement>
  ) => void;
  addNotification: (
    type: "success" | "error" | "warning" | "info",
    title: string,
    message: string,
    persistent?: boolean,
    duration?: number
  ) => void;
}

export const useElementUpdater = ({
  dynamicElements,
  trackElementUpdate,
  addNotification,
}: UseElementUpdaterProps) => {
  const handleUpdateElement = useCallback(
    (updatedElement: CustomElement) => {
      // Encontrar el elemento original para comparar cambios
      const originalElement = dynamicElements.find(
        (el) => el.id === updatedElement.id
      );

      // ❌ MVC: NO actualizar directamente, comentado
      // setDynamicElements((prev) =>
      //   prev.map((el) => (el.id === updatedElement.id ? updatedElement : el))
      // );

      // ❌ MVC: NO actualizar elemento seleccionado aún
      // setSelectedElement(updatedElement);

      // ✅ MVC: Mostrar indicador de procesamiento
      addNotification(
        "info",
        "Procesando...",
        `Actualizando "${updatedElement.className}"...`,
        true,
        2000
      );

      // Trackear la operación si hay cambios
      if (originalElement) {
        const changes: Partial<CustomElement> = {};
        if (originalElement.className !== updatedElement.className)
          changes.className = updatedElement.className;
        if (
          JSON.stringify(originalElement.attributes) !==
          JSON.stringify(updatedElement.attributes)
        )
          changes.attributes = updatedElement.attributes;
        if (
          JSON.stringify(originalElement.methods) !==
          JSON.stringify(updatedElement.methods)
        )
          changes.methods = updatedElement.methods;
        if (
          originalElement.x !== updatedElement.x ||
          originalElement.y !== updatedElement.y
        ) {
          changes.x = updatedElement.x;
          changes.y = updatedElement.y;
        }
        if (originalElement.stereotype !== updatedElement.stereotype)
          changes.stereotype = updatedElement.stereotype;
        if (originalElement.parentPackageId !== updatedElement.parentPackageId)
          changes.parentPackageId = updatedElement.parentPackageId;
        if (
          JSON.stringify(originalElement.containedElements || []) !==
          JSON.stringify(updatedElement.containedElements || [])
        )
          changes.containedElements = updatedElement.containedElements;
        if (originalElement.width !== updatedElement.width)
          changes.width = updatedElement.width;
        if (originalElement.height !== updatedElement.height)
          changes.height = updatedElement.height;

        if (Object.keys(changes).length > 0) {
          // ✅ MVC: SOLO enviar la operación al servidor
          trackElementUpdate(
            updatedElement.id,
            originalElement.className || "Elemento",
            changes
          );

          // ✅ La UI se actualizará cuando llegue la confirmación del servidor
          console.log("📤 Operación de actualización enviada al servidor");
        } else {
          console.log("ℹ️ No hay cambios para actualizar");
        }
      }

      // ✅ MVC: El grafo se actualizará cuando llegue la confirmación del servidor
    },
    [dynamicElements, trackElementUpdate, addNotification]
  );

  return {
    handleUpdateElement,
  };
};
