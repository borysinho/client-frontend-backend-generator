import { useCallback } from "react";
import type { UMLRelationship } from "../types";

interface UseRelationshipUpdaterProps {
  dynamicLinks: UMLRelationship[];
  trackRelationshipUpdate: (
    relationshipId: string,
    changes: Partial<UMLRelationship>
  ) => void;
  addNotification: (
    type: "success" | "error" | "warning" | "info",
    title: string,
    message: string,
    persistent?: boolean,
    duration?: number
  ) => void;
}

export const useRelationshipUpdater = ({
  dynamicLinks,
  trackRelationshipUpdate,
  addNotification,
}: UseRelationshipUpdaterProps) => {
  const handleUpdateRelationship = useCallback(
    (updatedRelationship: UMLRelationship) => {
      // Encontrar la relación original para comparar cambios
      const originalRelationship = dynamicLinks.find(
        (rel) => rel.id === updatedRelationship.id
      );

      // ❌ MVC: NO actualizar directamente
      // setDynamicLinks((prev) =>
      //   prev.map((rel) =>
      //     rel.id === updatedRelationship.id ? updatedRelationship : rel
      //   )
      // );

      // ❌ MVC: NO actualizar elemento seleccionado aún
      // setSelectedElement(updatedRelationship);

      // ✅ MVC: Mostrar indicador de procesamiento
      addNotification(
        "info",
        "Procesando...",
        "Actualizando relación...",
        true,
        2000
      );

      // Trackear la operación si hay cambios
      if (originalRelationship) {
        const changes: Partial<UMLRelationship> = {};

        // Verificar cambio en tipo de relación
        if (
          originalRelationship.relationship !== updatedRelationship.relationship
        ) {
          changes.relationship = updatedRelationship.relationship;
        }

        // Verificar cambio en label
        if (originalRelationship.label !== updatedRelationship.label) {
          changes.label = updatedRelationship.label;
        }

        // Verificar cambio en fullLabel
        if (originalRelationship.fullLabel !== updatedRelationship.fullLabel) {
          changes.fullLabel = updatedRelationship.fullLabel;
        }

        // Verificar cambio en sourceMultiplicity
        if (
          originalRelationship.sourceMultiplicity !==
          updatedRelationship.sourceMultiplicity
        ) {
          changes.sourceMultiplicity = updatedRelationship.sourceMultiplicity;
        }

        // Verificar cambio en targetMultiplicity
        if (
          originalRelationship.targetMultiplicity !==
          updatedRelationship.targetMultiplicity
        ) {
          changes.targetMultiplicity = updatedRelationship.targetMultiplicity;
        }

        // Verificar cambio en sourceRole
        if (
          originalRelationship.sourceRole !== updatedRelationship.sourceRole
        ) {
          changes.sourceRole = updatedRelationship.sourceRole;
        }

        // Verificar cambio en targetRole
        if (
          originalRelationship.targetRole !== updatedRelationship.targetRole
        ) {
          changes.targetRole = updatedRelationship.targetRole;
        }

        if (Object.keys(changes).length > 0) {
          // ✅ MVC: SOLO enviar la operación al servidor
          trackRelationshipUpdate(updatedRelationship.id, changes);
          console.log(
            "📤 Operación de actualización de relación enviada al servidor"
          );
          console.log("   Cambios detectados:", changes);
        } else {
          console.log("ℹ️ No hay cambios en la relación");
        }
      }

      // ✅ MVC: La UI se actualizará cuando el servidor confirme
    },
    [dynamicLinks, trackRelationshipUpdate, addNotification]
  );

  return {
    handleUpdateRelationship,
  };
};
