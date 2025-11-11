import { useState, useEffect } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import type { CustomElement, UMLRelationship } from "../types";
import { API_CONFIG } from "../utils/apiConfig";

interface UseDiagramLoaderResult {
  diagramName: string;
  setDiagramName: (name: string) => void;
  currentDiagramId: string | null;
  setCurrentDiagramId: (id: string | null) => void;
  dynamicElements: CustomElement[];
  setDynamicElements: React.Dispatch<React.SetStateAction<CustomElement[]>>;
  dynamicLinks: UMLRelationship[];
  setDynamicLinks: React.Dispatch<React.SetStateAction<UMLRelationship[]>>;
  elementCounter: number;
  setElementCounter: React.Dispatch<React.SetStateAction<number>>;
}

export function useDiagramLoader(): UseDiagramLoaderResult {
  const [searchParams] = useSearchParams();
  const { id: urlDiagramId } = useParams<{ id: string }>();
  const [diagramName, setDiagramName] = useState<string>("");
  const [currentDiagramId, setCurrentDiagramId] = useState<string | null>(null);
  const [dynamicElements, setDynamicElements] = useState<CustomElement[]>([]);
  const [dynamicLinks, setDynamicLinks] = useState<UMLRelationship[]>([]);
  const [elementCounter, setElementCounter] = useState(5);

  // Cargar diagrama desde BD o inicializar nuevo
  useEffect(() => {
    const loadDiagram = async () => {
      const userStr = localStorage.getItem("user");

      if (!userStr) {
        window.location.href = "/login";
        return;
      }

      const user = JSON.parse(userStr);

      if (urlDiagramId) {
        // Cargar diagrama existente por ID
        try {
          console.log("Cargando diagrama:", urlDiagramId);
          const response = await fetch(
            `${API_CONFIG.BASE_URL}/api/diagrams/${urlDiagramId}`
          );

          if (response.ok) {
            const diagram = await response.json();
            console.log("Diagrama cargado:", diagram);

            setDiagramName(diagram.name);
            setCurrentDiagramId(urlDiagramId);

            // Cargar elementos y relaciones desde el state
            const state = diagram.state || { elements: {}, relationships: {} };
            const elements = Object.values(state.elements || {}) as any[];

            // Convertir elementos a formato del frontend
            const loadedElements = elements.map((el: any) => ({
              id: el.id,
              className: el.className,
              attributes: el.attributes,
              methods: el.methods,
              elementType: el.elementType,
              stereotype: el.stereotype,
              parentPackageId: el.parentPackageId,
              containedElements: el.containedElements,
              x: el.x || 0,
              y: el.y || 0,
              width: el.width || 200,
              height: el.height || 120,
            }));

            // Convertir relaciones a formato del frontend
            const relationships = Object.values(
              state.relationships || {}
            ) as any[];
            const loadedRelationships = relationships
              .map((rel: any) => ({
                id: rel.id,
                source: rel.source,
                target: rel.target,
                relationship: rel.relationship,
                label: rel.label,
                sourceMultiplicity: rel.sourceMultiplicity,
                targetMultiplicity: rel.targetMultiplicity,
                sourceRole: rel.sourceRole,
                targetRole: rel.targetRole,
              }))
              // Filtrar relaciones que referencian elementos que no existen
              .filter((rel) => {
                const sourceExists = loadedElements.some(
                  (el) => el.id === rel.source
                );
                const targetExists = loadedElements.some(
                  (el) => el.id === rel.target
                );
                if (!sourceExists || !targetExists) {
                  console.warn(
                    `Filtrando relación ${rel.id} porque el elemento fuente (${rel.source}) o destino (${rel.target}) no existe`
                  );
                  return false;
                }
                return true;
              });

            setDynamicElements(loadedElements);
            setDynamicLinks(loadedRelationships);

            // Actualizar el contador de elementos para evitar conflictos de IDs
            const maxElementId = Math.max(
              ...loadedElements.map((el) => {
                const numId = parseInt(el.id);
                return isNaN(numId) ? 0 : numId;
              }),
              4 // Mínimo 5 (contador inicia en 5)
            );
            setElementCounter(maxElementId + 1);

            console.log("Elementos cargados:", loadedElements.length);
            console.log("Relaciones cargadas:", loadedRelationships.length);
            console.log(
              "Contador de elementos actualizado a:",
              maxElementId + 1
            );

            // Inicializar el historial con el estado cargado
            setTimeout(() => {}, 100);
          } else if (response.status === 404) {
            alert("Diagrama no encontrado");
            window.location.href = "/";
            return;
          } else {
            throw new Error("Error cargando diagrama");
          }
        } catch (error) {
          console.error("Error loading diagram:", error);
          alert("Error al cargar el diagrama");
          window.location.href = "/";
          return;
        }
      } else {
        // Flujo anterior para diagramas sin ID (por compatibilidad)
        const nameParam = searchParams.get("name");

        if (nameParam) {
          // Verificar si el nombre ya existe
          try {
            const response = await fetch(
              `${
                API_CONFIG.BASE_URL
              }/api/diagrams/check-name?name=${encodeURIComponent(
                nameParam
              )}&creatorId=${encodeURIComponent(user.id)}`
            );

            if (response.ok) {
              const { exists } = await response.json();
              if (exists) {
                alert(
                  `Ya tienes un diagrama con el nombre "${nameParam}". Por favor elige un nombre diferente.`
                );
                window.location.href = "/";
                return;
              }
            }
          } catch (error) {
            console.error("Error checking diagram name:", error);
          }

          setDiagramName(nameParam);
          // Generar diagramId para nuevos diagramas
          const newDiagramId = `diagram-${Date.now()}-${user.id}`;
          setCurrentDiagramId(newDiagramId);
        } else {
          // Pedir nombre y crear nuevo diagrama
          let name = prompt("Ingresa el nombre del diagrama:");
          let isValidName = false;

          while (!isValidName && name !== null) {
            if (!name || name.trim() === "") {
              alert("El nombre del diagrama es obligatorio");
              name = prompt("Ingresa el nombre del diagrama:");
              continue;
            }

            name = name.trim();

            try {
              const response = await fetch(
                `${
                  API_CONFIG.BASE_URL
                }/api/diagrams/check-name?name=${encodeURIComponent(
                  name
                )}&creatorId=${encodeURIComponent(user.id)}`
              );

              if (response.ok) {
                const { exists } = await response.json();
                if (exists) {
                  alert(
                    `Ya tienes un diagrama con el nombre "${name}". Por favor elige un nombre diferente.`
                  );
                  name = prompt("Ingresa el nombre del diagrama:");
                  continue;
                }
              }
            } catch (error) {
              console.error("Error checking diagram name:", error);
              alert("Error al verificar el nombre del diagrama");
              name = prompt("Ingresa el nombre del diagrama:");
              continue;
            }

            isValidName = true;
          }

          if (name && name.trim()) {
            setDiagramName(name.trim());
            const newDiagramId = `diagram-${Date.now()}-${user.id}`;
            setCurrentDiagramId(newDiagramId);
          } else {
            window.location.href = "/";
            return;
          }
        }
      }
    };

    loadDiagram();
  }, [urlDiagramId, searchParams]);

  return {
    diagramName,
    setDiagramName,
    currentDiagramId,
    setCurrentDiagramId,
    dynamicElements,
    setDynamicElements,
    dynamicLinks,
    setDynamicLinks,
    elementCounter,
    setElementCounter,
  };
}
