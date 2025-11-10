import { useCallback } from "react";
import type { CustomElement, UMLRelationship } from "../types";
import type { DiagramDelta } from "../services/AIService";

interface UseAIDiagramGeneratorProps {
  setDynamicElements: React.Dispatch<React.SetStateAction<CustomElement[]>>;
  setDynamicLinks: React.Dispatch<React.SetStateAction<UMLRelationship[]>>;
  dynamicElementsRef: React.MutableRefObject<CustomElement[]>;
  dynamicLinksRef: React.MutableRefObject<UMLRelationship[]>;
  addNotification: (
    type: "success" | "error" | "info" | "warning",
    title: string,
    message: string,
    autoClose?: boolean,
    duration?: number
  ) => void;
  setPendingAISave: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useAIDiagramGenerator = ({
  setDynamicElements,
  setDynamicLinks,
  dynamicElementsRef,
  dynamicLinksRef,
  addNotification,
  setPendingAISave,
}: UseAIDiagramGeneratorProps) => {
  const handleAIGenerateDiagram = useCallback(
    (delta: DiagramDelta) => {
      console.log("🤖 Procesando delta de IA:", delta);
      const newElements = delta.newElements as CustomElement[];
      const newRelationships = delta.newRelationships as UMLRelationship[];
      const removeElementIds = delta.removeElementIds || [];
      const removeRelationshipIds = delta.removeRelationshipIds || [];
      const updateElements = delta.updateElements || [];
      const updateRelationships = delta.updateRelationships || [];

      // Construir mensaje descriptivo de lo que hará la IA
      const changes: string[] = [];
      if (newElements.length > 0)
        changes.push(`${newElements.length} elementos nuevos`);
      if (newRelationships.length > 0)
        changes.push(`${newRelationships.length} relaciones nuevas`);
      if (removeElementIds.length > 0)
        changes.push(`${removeElementIds.length} elementos a eliminar`);
      if (removeRelationshipIds.length > 0)
        changes.push(`${removeRelationshipIds.length} relaciones a eliminar`);
      if (updateElements.length > 0)
        changes.push(`${updateElements.length} elementos a modificar`);
      if (updateRelationships.length > 0)
        changes.push(`${updateRelationships.length} relaciones a modificar`);

      console.log(`🤖 IA generó cambios: ${changes.join(", ")}`);

      // Mostrar indicador de procesamiento
      addNotification(
        "info",
        "Procesando IA...",
        changes.length > 0 ? changes.join(", ") : "Procesando cambios...",
        true,
        2000
      );

      // 1. AGREGAR nuevos elementos
      if (newElements.length > 0) {
        setDynamicElements((prev) => {
          const filtered = newElements.filter(
            (newEl) => !prev.some((existingEl) => existingEl.id === newEl.id)
          );
          console.log(`✅ Agregando ${filtered.length} elementos nuevos`);
          const updated = [...prev, ...filtered];
          // ✅ Actualizar ref inmediatamente ANTES del guardado
          dynamicElementsRef.current = updated;
          return updated;
        });
      }

      // 2. AGREGAR nuevas relaciones (después de que los elementos estén agregados)
      if (newRelationships.length > 0) {
        // Pequeño delay para asegurar que el estado se haya actualizado
        setTimeout(() => {
          setDynamicLinks((prev) => {
            // Obtener todos los elementos disponibles (iniciales + dinámicos actuales)
            const allElements = [...dynamicElementsRef.current];

            const filtered = newRelationships
              .filter(
                (newRel) =>
                  !prev.some((existingRel) => existingRel.id === newRel.id)
              )
              .filter((newRel) => {
                // Verificar que los elementos source y target existan
                const sourceExists = allElements.some(
                  (el) => el.id === newRel.source
                );
                const targetExists = allElements.some(
                  (el) => el.id === newRel.target
                );

                if (!sourceExists || !targetExists) {
                  console.warn(
                    `Filtrando relación ${
                      newRel.id
                    } porque el elemento fuente (${newRel.source}) o destino (${
                      newRel.target
                    }) no existe. Elementos disponibles: ${allElements
                      .map((el) => el.id)
                      .join(", ")}`
                  );
                  return false;
                }
                return true;
              })
              .map((rel) => ({
                // Solo mantener las propiedades permitidas
                id: rel.id,
                source: rel.source,
                target: rel.target,
                relationship: rel.relationship,
                label: rel.label,
                fullLabel: rel.fullLabel,
                sourceMultiplicity: rel.sourceMultiplicity,
                targetMultiplicity: rel.targetMultiplicity,
              }));
            console.log(
              `✅ Agregando ${filtered.length} relaciones nuevas (filtradas)`
            );
            const updated = [...prev, ...filtered];
            // ✅ Actualizar ref inmediatamente ANTES del guardado
            dynamicLinksRef.current = updated;
            return updated;
          });
        }, 0);
      }

      // 3. ELIMINAR elementos
      if (removeElementIds.length > 0) {
        setDynamicElements((prev) => {
          const filtered = prev.filter(
            (el) => !removeElementIds.includes(el.id)
          );
          console.log(
            `🗑️ Eliminando ${prev.length - filtered.length} elementos`
          );
          // ✅ Actualizar ref inmediatamente
          dynamicElementsRef.current = filtered;
          return filtered;
        });

        // También eliminar las relaciones asociadas a estos elementos
        setDynamicLinks((prev) => {
          const filtered = prev.filter(
            (link) =>
              !removeElementIds.includes(link.source) &&
              !removeElementIds.includes(link.target)
          );
          console.log(
            `🗑️ Eliminando ${
              prev.length - filtered.length
            } relaciones asociadas a elementos eliminados`
          );
          // ✅ Actualizar ref inmediatamente
          dynamicLinksRef.current = filtered;
          return filtered;
        });
      }

      // 4. ELIMINAR relaciones
      if (removeRelationshipIds.length > 0) {
        setDynamicLinks((prev) => {
          const filtered = prev.filter(
            (link) => !removeRelationshipIds.includes(link.id)
          );
          console.log(
            `🗑️ Eliminando ${prev.length - filtered.length} relaciones`
          );
          // ✅ Actualizar ref inmediatamente
          dynamicLinksRef.current = filtered;
          return filtered;
        });
      }

      // 5. MODIFICAR elementos (actualización parcial)
      if (updateElements.length > 0) {
        setDynamicElements((prev) => {
          const updated = prev.map((el) => {
            const update = updateElements.find((u) => u.id === el.id);
            if (update) {
              console.log(`✏️ Modificando elemento ${el.id}:`, update.changes);
              return { ...el, ...update.changes } as CustomElement;
            }
            return el;
          });
          // ✅ Actualizar ref inmediatamente
          dynamicElementsRef.current = updated;
          return updated;
        });
      }

      // 6. MODIFICAR relaciones (actualización parcial)
      if (updateRelationships.length > 0) {
        setDynamicLinks((prev) => {
          const updated = prev.map((link) => {
            const update = updateRelationships.find((u) => u.id === link.id);
            if (update) {
              // Filtrar solo las propiedades permitidas
              const allowedChanges: {
                label?: string;
                fullLabel?: string;
                sourceMultiplicity?: string;
                targetMultiplicity?: string;
              } = {};

              if (
                update.changes.label !== undefined &&
                update.changes.label !== null
              ) {
                allowedChanges.label = String(update.changes.label);
              }
              if (
                update.changes.fullLabel !== undefined &&
                update.changes.fullLabel !== null
              ) {
                allowedChanges.fullLabel = String(update.changes.fullLabel);
              }
              if (
                update.changes.sourceMultiplicity !== undefined &&
                update.changes.sourceMultiplicity !== null
              ) {
                allowedChanges.sourceMultiplicity = String(
                  update.changes.sourceMultiplicity
                );
              }
              if (
                update.changes.targetMultiplicity !== undefined &&
                update.changes.targetMultiplicity !== null
              ) {
                allowedChanges.targetMultiplicity = String(
                  update.changes.targetMultiplicity
                );
              }

              console.log(
                `✏️ Modificando relación ${link.id}:`,
                allowedChanges
              );
              return { ...link, ...allowedChanges } as UMLRelationship;
            }
            return link;
          });
          // ✅ Actualizar ref inmediatamente
          dynamicLinksRef.current = updated;
          return updated;
        });
      }

      // Notificación de éxito
      addNotification(
        "success",
        "IA completada",
        changes.length > 0
          ? `Cambios aplicados: ${changes.join(", ")}`
          : "Operación completada",
        true,
        4000
      );

      // 🔥 SOLUCIÓN: Guardar inmediatamente después de cambios de IA
      // para sincronizar elementos con el servidor antes de que el usuario
      // pueda crear relaciones manuales
      console.log("🔍 Verificando condición de guardado automático:", {
        newElements: newElements.length,
        newRelationships: newRelationships.length,
        removeElementIds: removeElementIds?.length || 0,
        removeRelationshipIds: removeRelationshipIds?.length || 0,
        updateElements: updateElements?.length || 0,
        updateRelationships: updateRelationships?.length || 0,
      });

      if (
        newElements.length > 0 ||
        newRelationships.length > 0 ||
        removeElementIds.length > 0 ||
        removeRelationshipIds.length > 0 ||
        updateElements.length > 0 ||
        updateRelationships.length > 0
      ) {
        console.log(
          "✅ Condición cumplida, marcando para guardado automático..."
        );
        // ✅ Usar flag para ejecutar guardado en useEffect, evitando closure stale
        setPendingAISave(true);
      }
    },
    [addNotification]
  );

  return {
    handleAIGenerateDiagram,
  };
};
