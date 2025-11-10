// types.ts - Definiciones de tipos para el editor UML

export type ElementType =
  | "class"
  | "interface"
  | "enumeration"
  | "package"
  | "note";

export type CustomElement = {
  id: string;
  className: string;
  attributes: string[];
  methods: string[];
  elementType: ElementType;
  stereotype?: string; // Estereotipo UML opcional (ej: "<<entity>>", "<<service>>")
  parentPackageId?: string; // ID del paquete que contiene este elemento (opcional)
  containedElements?: string[]; // IDs de elementos contenidos (solo para paquetes)
  x: number;
  y: number;
  width: number;
  height: number;
};

export type UMLRelationship = {
  id: string;
  source: string;
  target: string;
  relationship:
    | "association"
    | "aggregation"
    | "composition"
    | "generalization"
    | "dependency"
    | "realization";
  label?: string;
  fullLabel?: string; // Texto completo sin truncar para propiedades
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
  sourceRole?: string;
  targetRole?: string;
};

export type JsonPatchOperation = {
  op: "add" | "remove" | "replace" | "move" | "copy" | "test";
  path: string;
  value?: unknown;
  from?: string;
  clientId: string;
  timestamp: number;
  sequenceNumber: number;
  description: string;
};
