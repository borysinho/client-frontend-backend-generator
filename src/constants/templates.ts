// Constantes para validación de límites
export const ELEMENT_DIMENSIONS = {
  width: 200,
  height: 120,
  margin: 20,
} as const;

// Función de utilidad para validar límites de posición
export const validateElementPosition = (
  x: number,
  y: number,
  containerWidth?: number,
  containerHeight?: number,
  elementWidth: number = ELEMENT_DIMENSIONS.width,
  elementHeight: number = ELEMENT_DIMENSIONS.height
): { x: number; y: number } => {
  const margin = ELEMENT_DIMENSIONS.margin;

  let validatedX = x;
  let validatedY = y;

  // Validar límites horizontales
  if (containerWidth) {
    validatedX = Math.max(
      margin,
      Math.min(validatedX, containerWidth - elementWidth - margin)
    );
  } else {
    validatedX = Math.max(0, validatedX);
  }

  // Validar límites verticales
  if (containerHeight) {
    validatedY = Math.max(
      margin,
      Math.min(validatedY, containerHeight - elementHeight - margin)
    );
  } else {
    validatedY = Math.max(0, validatedY);
  }

  return { x: validatedX, y: validatedY };
};

// Templates para diferentes tipos de clases UML
export const classTemplates = {
  class: {
    className: "NuevaClase",
    attributes: ["- atributo1: String"],
    methods: ["+ metodo1(): void"],
    elementType: "class" as const,
  },
  interface: {
    className: "NuevaInterfaz",
    attributes: [],
    methods: ["metodoAbstracto(): void"], // Sin visibilidad, implícitamente público
    elementType: "interface" as const,
  },
  enumeration: {
    className: "Enumeracion",
    attributes: ["VALOR1", "VALOR2", "VALOR3"], // Valores literales sin tipo ni visibilidad
    methods: [],
    elementType: "enumeration" as const,
  },
  package: {
    className: "Paquete",
    attributes: [],
    methods: [],
    elementType: "package" as const,
    containedElements: [], // Paquetes pueden contener otros elementos
  },
  note: {
    className: "Nota",
    attributes: ["Esta es una nota importante sobre el diseño del sistema"], // Texto plano único
    methods: [],
    elementType: "note" as const,
  },
};

// Barra lateral de herramientas para agregar elementos
export const toolbarGroups = [
  {
    title: "📦 Elementos Estructurales",
    items: [
      { key: "class", label: "📄 Clase", color: "#4CAF50" },
      { key: "interface", label: "🔗 Interfaz", color: "#2196F3" },
      { key: "enumeration", label: "🔢 Enumeración", color: "#795548" },
      { key: "package", label: "📦 Paquete", color: "#3F51B5" },
      { key: "note", label: "📝 Nota", color: "#FFC107" },
    ],
  },
  {
    title: "🔗 Relaciones",
    items: [
      { key: "association", label: "➡️ Asociación", color: "#FF5722" },
      { key: "aggregation", label: "◇ Agregación", color: "#9C27B0" },
      { key: "composition", label: "◆ Composición", color: "#673AB7" },
      { key: "generalization", label: "△ Generalización", color: "#3F51B5" },
      { key: "dependency", label: "⤸ Dependencia", color: "#607D8B" },
      { key: "realization", label: "△ Realización", color: "#00BCD4" },
    ],
  },
];

// Mantener compatibilidad hacia atrás
export const toolbarItems = toolbarGroups.flatMap((group) => group.items);
