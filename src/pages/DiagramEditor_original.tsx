import React, {
  useCallback,
  useState,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { GraphProvider, createElements } from "@joint/react";
import { useSearchParams, useParams } from "react-router-dom";
import "../App.css";

// Importar tipos
import type { CustomElement, UMLRelationship } from "../types";

// Importar constantes
import {
  classTemplates,
  validateElementPosition,
} from "../constants/templates";
import { buildApiUrl } from "../utils/apiConfig";

// Importar utilidades
import {
  calculateElementWidth,
  calculateElementHeight,
} from "../utils/elementSizing";
import { convertRelationshipToLink } from "../utils/relationshipUtils";
import { truncateText } from "../utils/textUtils";

// Importar hooks
import {
  useDiagramSync,
  type JsonPatchOperation,
} from "../hooks/useDiagramSync";
import { useSocket } from "../hooks/useSocket";
import { useNotifications } from "../hooks/useNotifications";

// Importar componentes
import { Toolbar } from "../components/Toolbar";
import { PropertiesPanel } from "../components/PropertiesPanel";
import { UMLDiagram } from "../components/UMLDiagram";
import { AIBot } from "../components/AIBot";
import DatabaseConfigModal, {
  type DatabaseConfig,
} from "../components/DatabaseConfigModal";
import FlutterConfigModal from "../components/FlutterConfigModal";
import Header from "../components/Header";
import NotificationSystem from "../components/NotificationSystem";

const initialElements = createElements([
  // Diagrama vacío - sin elementos de ejemplo
]);

// Componente principal del diagrama UML
function DiagramEditor() {
  const [searchParams] = useSearchParams();
  const { id: urlDiagramId } = useParams<{ id: string }>();
  const [diagramName, setDiagramName] = useState<string>("");
  const [currentDiagramId, setCurrentDiagramId] = useState<string | null>(null);
  const [dynamicElements, setDynamicElements] = useState<CustomElement[]>([]);
  const [elementCounter, setElementCounter] = useState(5);
  const [graphSessionId] = useState(1);
  const [isAIBotVisible, setIsAIBotVisible] = useState(false);
  const [isDatabaseConfigModalOpen, setIsDatabaseConfigModalOpen] =
    useState(false);
  const [isFlutterConfigModalOpen, setIsFlutterConfigModalOpen] =
    useState(false);

  // Estado para auto-guardado
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [pendingAISave, setPendingAISave] = useState(false); // Flag para guardado después de IA
  // const [autoSaveEnabled, setAutoSaveEnabled] = useState(true); // TODO: Implementar toggle para activar/desactivar auto-guardado
  const autoSaveEnabled = true; // Por ahora siempre activado

  // ✅ Ref para acceder al estado más reciente de dynamicElements
  const dynamicElementsRef = useRef<CustomElement[]>([]);
  const dynamicLinksRef = useRef<UMLRelationship[]>([]);

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
          const response = await fetch(buildApiUrl(`api/diagrams/${urlDiagramId}`));

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
              `/api/diagrams/check-name?name=${encodeURIComponent(
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
                `/api/diagrams/check-name?name=${encodeURIComponent(
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

  // Configurar conexión Socket.IO usando el hook
  const { socket, isConnected } = useSocket();

  // Configurar sistema de notificaciones
  const { notifications, addNotification, removeNotification } =
    useNotifications();

  // Actualizar graphSessionId solo cuando cambie el diagrama actual
  useEffect(() => {
    if (isConnected && currentDiagramId) {
      console.log("📡 Conectado al servidor para colaboración en tiempo real");

      // Unirse al diagrama actual
      if (socket) {
        // Obtener información del usuario
        const userStr = localStorage.getItem("user");
        if (userStr) {
          const user = JSON.parse(userStr);
          // Registrar usuario con su nombre
          socket.emit("user:register", {
            name: user.name || user.username || user.email || "Usuario Anónimo",
            userId: user.id,
          });
        }

        // Unirse al diagrama
        socket.emit("diagram:join", currentDiagramId);
        console.log(`Unido al diagrama: ${currentDiagramId}`);
      }
      // No incrementar graphSessionId aquí para evitar recrear el grafo
    }
  }, [isConnected, socket, currentDiagramId]);

  const [selectedElement, setSelectedElement] = useState<
    CustomElement | UMLRelationship | null
  >(null);

  // Estados para manejar relaciones UML
  const [relationshipMode, setRelationshipMode] = useState<string | null>(null);
  const [firstSelectedElement, setFirstSelectedElement] =
    useState<CustomElement | null>(null);
  const [dynamicLinks, setDynamicLinks] = useState<UMLRelationship[]>([]);

  // ✅ MVC: Callback para aplicar operaciones confirmadas por el servidor
  const handleServerOperation = useCallback((operation: JsonPatchOperation) => {
    console.log("🔄 Aplicando operación del servidor:", operation);

    // Aplicar operación según su tipo
    if (operation.op === "add") {
      if (operation.path === "/elements/-" && operation.value) {
        // Agregar elemento
        const element = operation.value as CustomElement;
        setDynamicElements((prev) => {
          // Evitar duplicados
          if (prev.some((el) => el.id === element.id)) {
            console.log("⚠️ Elemento ya existe, omitiendo:", element.id);
            return prev;
          }
          console.log("✅ Agregando elemento desde servidor:", element.id);
          return [...prev, element];
        });
      } else if (operation.path === "/relationships/-" && operation.value) {
        // Agregar relación
        const relationship = operation.value as UMLRelationship;
        setDynamicLinks((prev) => {
          if (prev.some((rel) => rel.id === relationship.id)) {
            console.log("⚠️ Relación ya existe, omitiendo:", relationship.id);
            return prev;
          }
          console.log("✅ Agregando relación desde servidor:", relationship.id);
          return [...prev, relationship];
        });
      }
    } else if (operation.op === "remove") {
      // Remover elemento o relación
      const pathParts = operation.path.split("/");
      const id = pathParts[pathParts.length - 1];

      if (operation.path.startsWith("/elements/")) {
        setDynamicElements((prev) => prev.filter((el) => el.id !== id));
        console.log("✅ Elemento removido desde servidor:", id);
      } else if (operation.path.startsWith("/relationships/")) {
        setDynamicLinks((prev) => prev.filter((rel) => rel.id !== id));
        console.log("✅ Relación removida desde servidor:", id);
      }
    } else if (operation.op === "replace") {
      // Actualizar elemento o relación
      const pathParts = operation.path.split("/");
      const elementId = pathParts[2]; // /elements/{id}/...
      const field = pathParts[3]; // campo a actualizar

      if (operation.path.startsWith("/elements/")) {
        setDynamicElements((prev) =>
          prev.map((el) => {
            if (el.id === elementId) {
              console.log(
                `✅ Actualizando elemento ${elementId}, campo:`,
                field,
                "valor:",
                operation.value
              );

              // 📍 Caso especial: position es un objeto {x, y} que se debe expandir
              if (field === "position" && typeof operation.value === "object") {
                const { x, y } = operation.value as { x: number; y: number };
                // Solo actualizar si la posición realmente cambió (idempotencia)
                if (el.x === x && el.y === y) {
                  console.log(
                    `⏭️ Posición sin cambios para ${elementId}, omitiendo actualización`
                  );
                  return el;
                }
                return { ...el, x, y };
              }

              // Actualizar el campo específico
              return { ...el, [field]: operation.value };
            }
            return el;
          })
        );
      } else if (operation.path.startsWith("/relationships/")) {
        const relationshipId = pathParts[2];
        setDynamicLinks((prev) =>
          prev.map((rel) => {
            if (rel.id === relationshipId) {
              console.log(
                `✅ Actualizando relación ${relationshipId}, campo:`,
                field
              );
              return { ...rel, [field]: operation.value };
            }
            return rel;
          })
        );
      }
    }

    // ❌ REMOVIDO: El auto-guardado aquí causaba que se guardara el estado ANTES
    // de que React actualizara dynamicElements, resultando en un estado vacío en la BD.
    // El guardado se maneja correctamente en el auto-save timer y después de operaciones IA.
  }, []);
  // Hook para sincronización y tracking de operaciones
  const {
    operations,
    trackElementAddWithCallbacks,
    trackElementRemove,
    trackElementUpdate,
    trackRelationshipAdd,
    trackRelationshipRemove,
    trackRelationshipUpdate,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
    isSingleUser,
    activeUsers,
  } = useDiagramSync(
    socket || undefined,
    diagramName || "temp-diagram",
    addNotification,
    handleServerOperation // ✅ MVC: Pasar callback para manejar operaciones del servidor
  );

  // Función para guardar el diagrama
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
        const currentDynamicElements = dynamicElementsRef.current;
        const currentDynamicLinks = dynamicLinksRef.current;

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
          ? `/api/diagrams/${currentDiagramId}`
          : "/api/diagrams";
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
      // ✅ NO incluir dynamicElements/dynamicLinks porque usamos refs
    ]
  );

  // Función para imprimir
  const handlePrint = useCallback(() => {
    try {
      // Ajustar el diagrama antes de imprimir
      const diagramContainer = document.querySelector(".diagram-container");
      const svg = diagramContainer?.querySelector("svg");

      // Variables para restaurar el estado original
      let originalDisplayValues: Map<Element, string> = new Map();
      let originalViewBox: string | null = null;
      let originalPreserveAspectRatio: string | null = null;
      let originalBackground: string = "";

      if (svg) {
        // Guardar estados originales
        originalViewBox = svg.getAttribute("viewBox");
        originalPreserveAspectRatio = svg.getAttribute("preserveAspectRatio");
        originalBackground = svg.style.background;

        // Ocultar la cuadrícula de JointJS (grid mesh)
        const gridElements = svg.querySelectorAll(
          '[data-type="grid"], path[stroke="#ddd"], path[stroke="#dddddd"]'
        );
        gridElements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          originalDisplayValues.set(htmlEl, htmlEl.style.display);
          htmlEl.style.display = "none";
        });

        // Ocultar TODOS los elementos de cuadrícula posibles
        const allPaths = svg.querySelectorAll("path");
        allPaths.forEach((path) => {
          const stroke = path.getAttribute("stroke");
          if (
            stroke === "#ddd" ||
            stroke === "#dddddd" ||
            stroke === "rgba(221, 221, 221, 1)"
          ) {
            const htmlPath = path as unknown as HTMLElement;
            if (!originalDisplayValues.has(path)) {
              originalDisplayValues.set(path, htmlPath.style.display);
              htmlPath.style.display = "none";
            }
          }
        });

        // Obtener el bounding box de todos los elementos (excluyendo grid)
        const bbox = svg.getBBox();

        // Agregar un pequeño margen
        const margin = 20;
        const viewBox = `${bbox.x - margin} ${bbox.y - margin} ${
          bbox.width + 2 * margin
        } ${bbox.height + 2 * margin}`;

        // Configurar el viewBox para que muestre todo el contenido
        svg.setAttribute("viewBox", viewBox);
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

        // Asegurar que el SVG tenga fondo blanco solo para impresión
        svg.style.background = "white";

        console.log("ViewBox configurado para impresión:", viewBox);
        console.log("Elementos de grid ocultados:", originalDisplayValues.size);
      }

      // Función para restaurar el estado original
      const restoreOriginalState = () => {
        if (svg) {
          // Restaurar viewBox
          if (originalViewBox) {
            svg.setAttribute("viewBox", originalViewBox);
          } else {
            svg.removeAttribute("viewBox");
          }

          // Restaurar preserveAspectRatio
          if (originalPreserveAspectRatio) {
            svg.setAttribute(
              "preserveAspectRatio",
              originalPreserveAspectRatio
            );
          } else {
            svg.removeAttribute("preserveAspectRatio");
          }

          // Restaurar background
          svg.style.background = originalBackground;

          // Restaurar display de elementos
          originalDisplayValues.forEach((originalDisplay, element) => {
            (element as HTMLElement).style.display = originalDisplay;
          });

          console.log("Estado original restaurado");
        }
      };

      // Pequeño delay para asegurar que los cambios se apliquen
      setTimeout(() => {
        window.print();

        // Restaurar después de un breve momento (cuando se cierre el diálogo)
        // Usamos afterprint si está disponible, sino un timeout
        const afterPrint = () => {
          restoreOriginalState();
          window.removeEventListener("afterprint", afterPrint);
        };

        window.addEventListener("afterprint", afterPrint);

        // Fallback: restaurar después de 500ms si no se dispara afterprint
        setTimeout(() => {
          if (!window.matchMedia("print").matches) {
            restoreOriginalState();
          }
        }, 500);

        addNotification(
          "success",
          "Impresión Iniciada",
          "Se ha abierto el diálogo de impresión.",
          true,
          3000
        );
      }, 100);
    } catch (error) {
      console.error("Error al imprimir:", error);
      addNotification(
        "error",
        "Error de Impresión",
        "No se pudo iniciar la impresión. Por favor, inténtalo de nuevo.",
        true,
        8000
      );
    }
  }, [addNotification]);

  // Función para exportar
  const handleExport = useCallback(async () => {
    try {
      // Mostrar diálogo de selección
      const exportType = window.prompt(
        "Seleccione el formato de exportación:\n\n1. JSON (datos del diagrama)\n2. PNG (imagen)\n\nIngrese 1 o 2:",
        "2"
      );

      if (!exportType || !["1", "2"].includes(exportType.trim())) {
        addNotification(
          "warning",
          "Exportación Cancelada",
          "Selección inválida. La exportación ha sido cancelada.",
          true,
          3000
        );
        return;
      }

      const exportFormat = exportType.trim();
      const isPNG = exportFormat === "2";
      const diagramIdToExport = currentDiagramId || urlDiagramId;

      if (!diagramIdToExport) {
        addNotification(
          "error",
          "Error de Exportación",
          "Debes guardar el diagrama antes de exportarlo. Por favor, guarda el diagrama primero.",
          true,
          8000
        );
        return;
      }

      // Para PNG, generamos la imagen en el cliente
      if (isPNG) {
        const diagramContainer = document.querySelector(".diagram-container");
        const svg = diagramContainer?.querySelector("svg");

        if (!svg) {
          throw new Error("No se encontró el SVG del diagrama");
        }

        // Clonar el SVG para no afectar el original
        const svgClone = svg.cloneNode(true) as SVGElement;

        // Ocultar la cuadrícula en el clon
        const gridElements = svgClone.querySelectorAll(
          '[data-type="grid"], path[stroke="#ddd"], path[stroke="#dddddd"]'
        );
        gridElements.forEach((el) => {
          (el as HTMLElement).style.display = "none";
        });

        // Calcular viewBox sin cuadrícula
        const bbox = svg.getBBox();
        const margin = 20;
        const viewBox = `${bbox.x - margin} ${bbox.y - margin} ${
          bbox.width + 2 * margin
        } ${bbox.height + 2 * margin}`;

        svgClone.setAttribute("viewBox", viewBox);
        svgClone.setAttribute("width", `${bbox.width + 2 * margin}`);
        svgClone.setAttribute("height", `${bbox.height + 2 * margin}`);
        svgClone.style.background = "white";

        // Convertir SVG a PNG
        const svgData = new XMLSerializer().serializeToString(svgClone);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new Image();

        canvas.width = bbox.width + 2 * margin;
        canvas.height = bbox.height + 2 * margin;

        img.onload = () => {
          if (ctx) {
            // Fondo blanco
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            // Dibujar SVG
            ctx.drawImage(img, 0, 0);

            // Descargar PNG
            canvas.toBlob((blob) => {
              if (blob) {
                const url = window.URL.createObjectURL(blob);
                const fileName = `${diagramName || "diagrama"}_${
                  new Date().toISOString().split("T")[0]
                }.png`;

                const linkElement = document.createElement("a");
                linkElement.href = url;
                linkElement.download = fileName;
                document.body.appendChild(linkElement);
                linkElement.click();
                document.body.removeChild(linkElement);
                window.URL.revokeObjectURL(url);

                addNotification(
                  "success",
                  "Exportación Completada",
                  `El diagrama se ha exportado como "${fileName}".`,
                  true,
                  3000
                );
              }
            });
          }
        };

        img.src =
          "data:image/svg+xml;base64," +
          btoa(unescape(encodeURIComponent(svgData)));
        return;
      }

      // Para JSON, usar el endpoint del servidor
      const endpoint = `/api/diagrams/${diagramIdToExport}/export/json`;

      const response = await fetch(endpoint);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error ${response.status}: ${errorText}`);
      }

      // Descarga directa del JSON
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const fileName = `${diagramName || "diagrama"}_${
        new Date().toISOString().split("T")[0]
      }.json`;

      const linkElement = document.createElement("a");
      linkElement.href = url;
      linkElement.download = fileName;
      document.body.appendChild(linkElement);
      linkElement.click();
      document.body.removeChild(linkElement);
      window.URL.revokeObjectURL(url);

      addNotification(
        "success",
        "Exportación Completada",
        `El diagrama se ha exportado correctamente.`,
        true,
        3000
      );
    } catch (error) {
      console.error("Error al exportar:", error);
      addNotification(
        "error",
        "Error de Exportación",
        "No se pudo exportar el diagrama. Por favor, inténtalo de nuevo.",
        true,
        8000
      );
    }
  }, [diagramName, currentDiagramId, urlDiagramId, addNotification]);

  // Función para importar diagrama desde JSON
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
          setDynamicElements(elements);
          setDynamicLinks(relationships);

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
  }, [addNotification]);

  // Función para generar backend
  const handleGenerateBackend = useCallback(() => {
    console.log("handleGenerateBackend - diagramName:", diagramName);
    if (!diagramName || diagramName.trim() === "") {
      addNotification(
        "error",
        "Diagrama requerido",
        "Debes crear o cargar un diagrama antes de generar el backend.",
        true,
        8000
      );
      return;
    }
    setIsDatabaseConfigModalOpen(true);
  }, [diagramName, addNotification]);

  // Función para abrir modal de configuración de Flutter
  const handleGenerateFlutter = useCallback(() => {
    console.log("handleGenerateFlutter - currentDiagramId:", currentDiagramId);

    if (!currentDiagramId) {
      addNotification(
        "error",
        "Diagrama requerido",
        "Debes crear o cargar un diagrama antes de generar el frontend.",
        true,
        8000
      );
      return;
    }

    setIsFlutterConfigModalOpen(true);
  }, [currentDiagramId, addNotification]);

  // Función para confirmar generación de Flutter con URL del backend
  const handleConfirmFlutterGeneration = useCallback(
    async (apiBaseUrl: string) => {
      try {
        setIsFlutterConfigModalOpen(false);

        addNotification(
          "info",
          "Generando Frontend Flutter",
          "Generando proyecto Flutter...",
          true
        );

        const response = await fetch(buildApiUrl("api/flutter/generate"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            diagramId: currentDiagramId,
            apiBaseUrl: apiBaseUrl,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Error generando proyecto Flutter");
        }

        // Descargar el archivo ZIP
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `flutter-${diagramName || "proyecto"}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        addNotification(
          "success",
          "Frontend Flutter Generado",
          "El proyecto Flutter ha sido generado y descargado exitosamente.",
          true,
          5000
        );
      } catch (error) {
        console.error("Error generando Flutter:", error);
        addNotification(
          "error",
          "Error al Generar Frontend",
          error instanceof Error ? error.message : "Error desconocido",
          true,
          8000
        );
      }
    },
    [currentDiagramId, diagramName, addNotification]
  );

  // Función para confirmar generación de backend con configuración de BD
  const handleConfirmBackendGeneration = useCallback(
    async (dbConfig: DatabaseConfig) => {
      try {
        setIsDatabaseConfigModalOpen(false);

        addNotification(
          "info",
          "Generando Backend",
          "1/3: Transformando diagrama a modelo físico...",
          true,
          5000
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

        const response = await fetch(buildApiUrl("api/diagrams/generate-backend"), {
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
        });

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
    [diagramName, currentDiagramId, addNotification]
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent, template: keyof typeof classTemplates) => {
      e.dataTransfer.setData("text/plain", template);
      e.dataTransfer.effectAllowed = "copy";
    },
    []
  );

  const handleAddElement = useCallback(
    (
      template: keyof typeof classTemplates | string,
      x?: number,
      y?: number,
      containerWidth?: number,
      containerHeight?: number
    ) => {
      console.log("Adding element/relationship:", template, x, y);

      // Verificar si es una relación UML
      const relationshipTypes = [
        "association",
        "aggregation",
        "composition",
        "generalization",
        "dependency",
        "realization",
      ];
      if (relationshipTypes.includes(template)) {
        // Activar modo de relación
        setRelationshipMode(template);
        setFirstSelectedElement(null);
        console.log("Relationship mode activated:", template);
        return;
      }

      const templateData =
        classTemplates[template as keyof typeof classTemplates];

      // Solicitar nombre para elementos estructurales
      const structuralTypes = ["class", "interface", "enumeration", "package"];
      let elementName = templateData.className;
      if (structuralTypes.includes(template)) {
        const name = prompt("Ingresa el nombre del elemento:");
        if (name === null) return; // Usuario canceló
        const trimmedName = name.trim();
        if (trimmedName === "") {
          alert("El nombre no puede estar vacío.");
          return;
        }
        elementName = trimmedName;
      }

      // Usar posición proporcionada o calcular automáticamente
      let newX: number, newY: number;

      if (x !== undefined && y !== undefined) {
        const elementWidth = calculateElementWidth({
          className: elementName,
          attributes: templateData.attributes,
          methods: templateData.methods,
          elementType: templateData.elementType,
        });
        const elementHeight = calculateElementHeight({
          className: elementName,
          attributes: templateData.attributes,
          methods: templateData.methods,
          elementType: templateData.elementType,
        });

        // Posición específica del drop - centrar basado en dimensiones calculadas
        const centeredX = x - elementWidth / 2; // Centrar horizontalmente
        const centeredY = y - elementHeight / 2; // Centrar verticalmente

        console.log("Posición original del drop:", x, y);
        console.log("Posición centrada:", centeredX, centeredY);

        const validatedPosition = validateElementPosition(
          centeredX,
          centeredY,
          containerWidth,
          containerHeight,
          elementWidth,
          elementHeight
        );

        console.log("Posición validada:", validatedPosition);

        newX = validatedPosition.x;
        newY = validatedPosition.y;
      } else {
        // Posición automática - también validar límites
        const existingElements = [...initialElements, ...dynamicElements];
        const maxX = Math.max(...existingElements.map((el) => el.x || 0), 0);
        const maxY = Math.max(...existingElements.map((el) => el.y || 0), 0);

        newX = maxX + 250;
        newY = maxY > 200 ? 50 : maxY + 170;

        // Validar límites para posición automática
        const elementWidth = calculateElementWidth({
          className: elementName,
          attributes: templateData.attributes,
          methods: templateData.methods,
          elementType: templateData.elementType,
        });
        const elementHeight = calculateElementHeight({
          className: elementName,
          attributes: templateData.attributes,
          methods: templateData.methods,
          elementType: templateData.elementType,
        });

        const validatedPosition = validateElementPosition(
          newX,
          newY,
          containerWidth,
          containerHeight,
          elementWidth,
          elementHeight
        );

        newX = validatedPosition.x;
        newY = validatedPosition.y;

        // Si se sale por el lado derecho, empezar nueva fila
        if (containerWidth && newX + elementWidth + 20 > containerWidth) {
          newX = 20;
          newY = newY + elementHeight + 20;
        }

        // Si se sale por abajo, reiniciar desde arriba
        if (containerHeight && newY + elementHeight + 20 > containerHeight) {
          newY = 20;
        }
      }

      const newElement = {
        id: elementCounter.toString(),
        className: elementName,
        attributes: [...templateData.attributes],
        methods: [...templateData.methods],
        elementType: templateData.elementType,
        ...(templateData.elementType === "package" && {
          containedElements: [],
        }),
        x: newX,
        y: newY,
        width: calculateElementWidth({
          className: elementName,
          attributes: templateData.attributes,
          methods: templateData.methods,
          elementType: templateData.elementType,
        }),
        height: calculateElementHeight({
          className: elementName,
          attributes: templateData.attributes,
          methods: templateData.methods,
          elementType: templateData.elementType,
        }),
      };

      console.log(
        "Creando elemento con ID:",
        newElement.id,
        "Contador actual:",
        elementCounter
      );

      // Incrementar contador inmediatamente para evitar conflictos de IDs
      setElementCounter((prev) => {
        const newCounter = prev + 1;
        console.log("Incrementando contador de", prev, "a", newCounter);
        return newCounter;
      });

      // ✅ MVC CORRECTO: Mostrar indicador de procesamiento
      addNotification(
        "info",
        "Procesando...",
        `Agregando "${newElement.className}" (${newElement.elementType})...`,
        true, // Auto-close
        2000
      );

      // ✅ MVC CORRECTO: SOLO enviar operación al servidor
      // La UI se actualizará cuando el servidor confirme mediante el evento "operation:confirmed"
      trackElementAddWithCallbacks(
        newElement,
        // Callback de confirmación - El servidor ya notificó a todas las vistas
        () => {
          console.log(
            "✅ Operación confirmada por servidor:",
            newElement.className,
            "ID:",
            newElement.id
          );
          // ✅ Notificación de éxito DESPUÉS de la confirmación
          addNotification(
            "success",
            "Elemento Agregado",
            `"${newElement.className}" (${newElement.elementType}) se agregó correctamente al diagrama.`,
            true,
            3000
          );
        },
        // Callback de rechazo - Mostrar error (la UI nunca se modificó)
        (_, reason) => {
          console.log(
            "❌ Operación rechazada por servidor:",
            newElement.className,
            "razón:",
            reason
          );

          // ✅ Solo notificar el error, no hay que revertir nada en la UI
          addNotification(
            "error",
            "Elemento No Agregado",
            `No se pudo agregar "${newElement.className}" (${newElement.elementType}). ${reason}`,
            false // No auto-close para errores importantes
          );
        }
      );

      console.log("Element operation sent:", newElement);
    },
    [
      dynamicElements,
      elementCounter,
      trackElementAddWithCallbacks,
      addNotification,
    ]
  );

  const handleAIGenerateDiagram = useCallback(
    (delta: {
      newElements: unknown[];
      newRelationships: unknown[];
      removeElementIds?: string[];
      removeRelationshipIds?: string[];
      updateElements?: Array<{ id: string; changes: Record<string, unknown> }>;
      updateRelationships?: Array<{
        id: string;
        changes: Record<string, unknown>;
      }>;
    }) => {
      console.log("🤖 handleAIGenerateDiagram llamado con delta:", delta);
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
            const allElements = [
              ...initialElements,
              ...dynamicElementsRef.current,
            ];

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

  // ✅ useEffect para ejecutar guardado DESPUÉS de que React actualice dynamicElements
  useEffect(() => {
    if (pendingAISave && currentDiagramId) {
      console.log(
        "⏰ Ejecutando handleSaveDiagram desde guardado automático IA"
      );
      handleSaveDiagram(true); // Guardado silencioso
      setPendingAISave(false); // Reset flag
    }
  }, [pendingAISave, currentDiagramId, handleSaveDiagram]);

  const handleSelectElement = useCallback(
    (element: CustomElement | UMLRelationship | null) => {
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

              // ❌ MVC: NO agregar directamente
              // setDynamicLinks((prev) => [...prev, newRelationship]);

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
    [
      relationshipMode,
      firstSelectedElement,
      trackRelationshipAdd,
      addNotification,
    ]
  );

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

      // ✅ MVC: El grafo se actualizará cuando el servidor confirme
    },
    [dynamicElements, trackElementUpdate, addNotification]
  );

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
      handleSaveDiagram,
    ]
  );

  const handleAssignToPackage = useCallback(
    (elementId: string, packageId: string | null) => {
      // Encontrar el elemento original antes del cambio
      const originalElement = dynamicElements.find((el) => el.id === elementId);

      setDynamicElements((prev) =>
        prev.map((el) => {
          if (el.id === elementId) {
            // Actualizar el parentPackageId del elemento
            const updatedElement = {
              ...el,
              parentPackageId: packageId || undefined,
            };
            return updatedElement;
          } else if (el.elementType === "package") {
            // Si es un paquete, actualizar su lista de elementos contenidos
            if (packageId === el.id) {
              // Agregar el elemento a este paquete
              const containedElements = el.containedElements || [];
              if (!containedElements.includes(elementId)) {
                return {
                  ...el,
                  containedElements: [...containedElements, elementId],
                };
              }
            } else if (el.containedElements?.includes(elementId)) {
              // Remover el elemento de este paquete si estaba asignado a otro
              return {
                ...el,
                containedElements: el.containedElements.filter(
                  (id) => id !== elementId
                ),
              };
            }
          }
          return el;
        })
      );

      // Trackear el cambio de paquete del elemento
      if (originalElement) {
        const newPackageId = packageId || undefined;
        if (originalElement.parentPackageId !== newPackageId) {
          trackElementUpdate(
            elementId,
            originalElement.className || "Elemento",
            { parentPackageId: newPackageId }
          );
        }
      }
    },
    [dynamicElements, trackElementUpdate]
  );

  const handleElementMove = useCallback(
    (elementId: string, x: number, y: number) => {
      console.log("📍 Elemento movido:", elementId, "a posición:", x, y);

      // Buscar el elemento para obtener su nombre
      const element = dynamicElements.find((el) => el.id === elementId);
      if (!element) {
        console.warn("Elemento no encontrado:", elementId);
        return;
      }

      // Verificar si la posición realmente cambió
      if (element.x === x && element.y === y) {
        console.log("Posición sin cambios, ignorando");
        return;
      }

      // 🎯 OPTIMISTIC UPDATE: Actualizar UI inmediatamente para mejor UX
      setDynamicElements((prev) =>
        prev.map((el) => (el.id === elementId ? { ...el, x, y } : el))
      );

      // 🔄 UNDO/REDO: Enviar operación al servidor para tracking
      console.log("📤 Enviando cambio de posición al servidor");
      trackElementUpdate(elementId, element.className || "Elemento", {
        x,
        y,
      });
    },
    [dynamicElements, trackElementUpdate]
  );

  // Efecto para manejar la tecla Escape y cerrar el panel de propiedades
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && selectedElement) {
        handleSelectElement(null);
      }
    };

    // Agregar el event listener cuando hay un elemento seleccionado
    if (selectedElement) {
      document.addEventListener("keydown", handleKeyDown);
    }

    // Cleanup: remover el event listener
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedElement, handleSelectElement]); // Dependencias necesarias

  // Combinar elementos iniciales con dinámicos
  const allElements = useMemo(
    () => [...initialElements, ...dynamicElements],
    [dynamicElements]
  );

  // Debug: Log cuando cambie dynamicElements
  useEffect(() => {
    console.log(
      "🔄 dynamicElements cambió:",
      dynamicElements.length,
      dynamicElements.map((el) => ({ id: el.id, name: el.className }))
    );
    // ✅ Actualizar ref con el valor más reciente
    dynamicElementsRef.current = dynamicElements;
  }, [dynamicElements]);

  // ✅ Actualizar ref de links
  useEffect(() => {
    dynamicLinksRef.current = dynamicLinks;
  }, [dynamicLinks]);

  // Detectar cambios en elementos o relaciones para marcar cambios pendientes
  useEffect(() => {
    if (currentDiagramId) {
      setHasUnsavedChanges(true);
    }
  }, [dynamicElements, dynamicLinks, currentDiagramId]);

  // Auto-guardado cada 30 segundos
  useEffect(() => {
    if (!autoSaveEnabled || !currentDiagramId || !hasUnsavedChanges) {
      return;
    }

    const autoSaveInterval = setInterval(async () => {
      console.log("🔄 Auto-guardando diagrama...");
      setIsAutoSaving(true);

      try {
        await handleSaveDiagram(true); // Guardado silencioso
        console.log("✅ Auto-guardado completado");
      } catch (error) {
        console.error("❌ Error en auto-guardado:", error);
      } finally {
        setIsAutoSaving(false);
      }
    }, 30000); // 30 segundos

    return () => {
      clearInterval(autoSaveInterval);
    };
  }, [currentDiagramId, hasUnsavedChanges, handleSaveDiagram, autoSaveEnabled]);

  // Crear elementos JointJS vacíos para que JointJS sepa de su existencia (solo para conexiones)
  const jointElements = useMemo(
    () =>
      allElements.map((element: CustomElement) => ({
        id: element.id,
        type: "standard.Rectangle",
        position: { x: element.x, y: element.y },
        size: { width: element.width, height: element.height },
        attrs: {
          body: { fill: "transparent", stroke: "transparent", strokeWidth: 0 },
          label: { text: "" },
        },
      })),
    [allElements]
  );

  // Crear mapa de elementos por ID para acceso rápido
  const elementMap = useMemo(() => {
    const map = new Map<string, CustomElement>();
    allElements.forEach((element) => {
      map.set(element.id, element);
    });
    console.log("📋 elementMap actualizado:", map.size, "elementos");
    return map;
  }, [allElements]);

  // Convertir relaciones dinámicas a links de JointJS con multiplicidad
  const convertedDynamicLinks = dynamicLinks.map(convertRelationshipToLink);

  // Usar links convertidos (initialLinks estaba vacío)
  const allLinks = convertedDynamicLinks;
  console.log(
    "All elements:",
    allElements.length,
    "dynamic:",
    dynamicElements.length
  );

  // Recrear el key del GraphProvider solo cuando cambie la sesión
  // Los elementos se sincronizan dinámicamente sin recrear el grafo
  const graphKey = `graph-session-${graphSessionId}`;

  return (
    <div className="app-container">
      <Header
        title={
          diagramName ? `Diagrama: ${diagramName}` : "Diagrama UML Colaborativo"
        }
        operations={operations}
        socket={socket || undefined}
        onSave={handleSaveDiagram}
        isAutoSaving={isAutoSaving}
      />

      {/* Sistema de notificaciones */}
      <NotificationSystem
        notifications={notifications}
        onRemove={removeNotification}
      />

      {/* Overlay de instrucciones para modo relación */}
      {relationshipMode && (
        <div className="relationship-overlay">
          <strong>Modo Relación:</strong> Creando {relationshipMode}.
          {firstSelectedElement
            ? ` Origen: "${firstSelectedElement.className}". Haz click en el elemento destino.`
            : " Haz click en el elemento origen."}
          <button
            onClick={() => {
              setRelationshipMode(null);
              setFirstSelectedElement(null);
            }}
            style={{
              marginLeft: "10px",
              backgroundColor: "#6C757D",
              color: "white",
              border: "none",
              borderRadius: "3px",
              padding: "2px 6px",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            ✕
          </button>
        </div>
      )}

      <div className="app-content">
        <Toolbar
          onDragStart={handleDragStart}
          onClick={handleAddElement}
          onAIBotClick={() => setIsAIBotVisible(true)}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          isSingleUser={isSingleUser}
          activeUsers={activeUsers}
          onPrint={handlePrint}
          onExport={handleExport}
          onImport={handleImport}
          onGenerateBackend={handleGenerateBackend}
          onGenerateFlutter={handleGenerateFlutter}
        />

        <div className="diagram-container">
          <GraphProvider
            key={graphKey}
            initialElements={jointElements}
            initialLinks={allLinks}
          >
            <UMLDiagram
              onAddElement={handleAddElement}
              onSelectElement={handleSelectElement}
              onElementMove={handleElementMove}
              elementMap={elementMap}
              relationships={dynamicLinks}
            />
          </GraphProvider>
        </div>

        {selectedElement && (
          <div className="properties-container">
            <PropertiesPanel
              selectedElement={selectedElement}
              onUpdateElement={handleUpdateElement}
              onUpdateRelationship={handleUpdateRelationship}
              onDeleteElement={handleDeleteElement}
              onAssignToPackage={handleAssignToPackage}
              allElements={[...initialElements, ...dynamicElements]}
              onClose={() => handleSelectElement(null)}
            />
          </div>
        )}
      </div>

      {/* Bot de IA */}
      <AIBot
        onGenerateDiagram={handleAIGenerateDiagram}
        existingClasses={dynamicElements.map((el) => el.className)}
        currentElements={dynamicElements}
        currentRelationships={dynamicLinks}
        isVisible={isAIBotVisible}
        onClose={() => setIsAIBotVisible(false)}
        diagramId={currentDiagramId || undefined}
        userId={(() => {
          const userStr = localStorage.getItem("user");
          return userStr ? JSON.parse(userStr).id : undefined;
        })()}
        userName={(() => {
          const userStr = localStorage.getItem("user");
          return userStr ? JSON.parse(userStr).name : undefined;
        })()}
        socket={socket}
      />

      {/* Modal de configuración de base de datos */}
      <DatabaseConfigModal
        isOpen={isDatabaseConfigModalOpen}
        onClose={() => setIsDatabaseConfigModalOpen(false)}
        onConfirm={handleConfirmBackendGeneration}
        diagramName={diagramName}
      />

      {/* Modal de configuración de Flutter */}
      <FlutterConfigModal
        isOpen={isFlutterConfigModalOpen}
        onClose={() => setIsFlutterConfigModalOpen(false)}
        onConfirm={handleConfirmFlutterGeneration}
      />
    </div>
  );
}

export default DiagramEditor;
