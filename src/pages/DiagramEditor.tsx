import React, {
  useCallback,
  useState,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { GraphProvider, createElements } from "@joint/react";
import { useParams } from "react-router-dom";
import "../App.css";

// Importar tipos
import type { CustomElement, UMLRelationship } from "../types";

// Importar constantes
import {
  classTemplates,
  validateElementPosition,
} from "../constants/templates";

// Importar utilidades
import {
  calculateElementWidth,
  calculateElementHeight,
} from "../utils/elementSizing";
import { convertRelationshipToLink } from "../utils/relationshipUtils";
import { apiFetch } from "../utils/api";

// Importar hooks
import {
  useDiagramSync,
  type JsonPatchOperation,
} from "../hooks/useDiagramSync";
import { useSocket } from "../hooks/useSocket";
import { useNotifications } from "../hooks/useNotifications";
import { useDiagramLoader } from "../hooks/useDiagramLoader";
import { useRelationshipHandler } from "../hooks/useRelationshipHandler";
import { useDiagramSaver } from "../hooks/useDiagramSaver";
import { useAIDiagramGenerator } from "../hooks/useAIDiagramGenerator";
import { useDiagramExporter } from "../hooks/useDiagramExporter";
import { useDiagramImporter } from "../hooks/useDiagramImporter";
import { useBackendGenerator } from "../hooks/useBackendGenerator";
import { useElementUpdater } from "../hooks/useElementUpdater";
import { useRelationshipUpdater } from "../hooks/useRelationshipUpdater";
import { useElementDeleter } from "../hooks/useElementDeleter";

// Importar componentes
import { Toolbar } from "../components/Toolbar";
import { PropertiesPanel } from "../components/PropertiesPanel";
import { UMLDiagram } from "../components/UMLDiagram";
import { AIBot } from "../components/AIBot";
import DatabaseConfigModal from "../components/DatabaseConfigModal";
import FlutterConfigModal from "../components/FlutterConfigModal";
import Header from "../components/Header";
import NotificationSystem from "../components/NotificationSystem";

const initialElements = createElements([
  // Diagrama vacío - sin elementos de ejemplo
]);

// Componente principal del diagrama UML
function DiagramEditor() {
  const { id: urlDiagramId } = useParams<{ id: string }>();

  // Usar hook personalizado para cargar diagramas
  const {
    diagramName,
    currentDiagramId,
    setCurrentDiagramId,
    dynamicElements,
    setDynamicElements,
    dynamicLinks,
    setDynamicLinks,
    elementCounter,
    setElementCounter,
  } = useDiagramLoader();

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

  // Configurar conexión Socket.IO usando el hook
  const { socket, isConnected } = useSocket();

  // Configurar sistema de notificaciones
  const { notifications, addNotification, removeNotification } =
    useNotifications();

  // Configurar manejo de relaciones
  const {
    relationshipMode,
    setRelationshipMode,
    firstSelectedElement,
    setFirstSelectedElement,
    handleRelationshipSelection,
  } = useRelationshipHandler();

  // Configurar guardado de diagramas
  const { handleSaveDiagram } = useDiagramSaver({
    diagramName,
    currentDiagramId,
    setCurrentDiagramId,
    setHasUnsavedChanges,
    dynamicElementsRef,
    dynamicLinksRef,
    addNotification,
  });

  // Configurar generador de diagramas con IA
  const { handleAIGenerateDiagram } = useAIDiagramGenerator({
    setDynamicElements,
    setDynamicLinks,
    dynamicElementsRef,
    dynamicLinksRef,
    addNotification,
    setPendingAISave,
  });

  // Configurar exportador de diagramas
  const { handleExport } = useDiagramExporter({
    diagramName,
    currentDiagramId,
    urlDiagramId,
    addNotification,
  });

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

  // Configurar importador de diagramas
  const { handleImport } = useDiagramImporter({
    setDynamicElements,
    setDynamicLinks,
    addNotification,
    trackElementAdd: trackElementAddWithCallbacks,
    trackRelationshipAdd,
  });

  // Configurar generador de backend
  const { handleConfirmBackendGeneration } = useBackendGenerator({
    setIsDatabaseConfigModalOpen,
    addNotification,
    dynamicElementsRef,
    dynamicLinksRef,
    initialElements,
    diagramName,
    currentDiagramId,
  });

  // Configurar actualizador de elementos
  const { handleUpdateElement } = useElementUpdater({
    dynamicElements,
    trackElementUpdate,
    addNotification,
  });

  // Configurar actualizador de relaciones
  const { handleUpdateRelationship } = useRelationshipUpdater({
    dynamicLinks,
    trackRelationshipUpdate,
    addNotification,
  });

  // Configurar eliminador de elementos
  const { handleDeleteElement } = useElementDeleter({
    trackElementRemove,
    trackRelationshipRemove,
    addNotification,
    setSelectedElement,
    handleSaveDiagram,
  });

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

  // Función para importar diagrama desde JSON
  // Movido a useDiagramImporter hook

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

        const response = await apiFetch("/api/flutter/generate", {
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
  // Movido a useBackendGenerator hook

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
      handleRelationshipSelection(
        element,
        trackRelationshipAdd,
        addNotification,
        setSelectedElement
      );
    },
    [handleRelationshipSelection, trackRelationshipAdd, addNotification]
  );

  // Función para actualizar elementos
  // Movido a useElementUpdater hook

  // Función para actualizar relaciones
  // Movido a useRelationshipUpdater hook

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
