import type { UMLRelationship, CustomElement } from "../types";

// Función para convertir CustomElement a elemento de JointJS
export const convertElementToJoint = (element: CustomElement) => {
  return {
    id: element.id,
    type: "standard.Rectangle",
    position: { x: element.x, y: element.y },
    size: { width: element.width, height: element.height },
    attrs: {
      body: {
        fill: "#E3F2FD",
        stroke: "#1976D2",
        strokeWidth: 2,
      },
      label: {
        text: element.className,
        fill: "#1976D2",
        fontSize: 14,
        fontWeight: "bold",
      },
    },
  };
};

import { truncateText } from "./textUtils";
export const convertRelationshipToLink = (relationship: UMLRelationship) => {
  console.log(`🔗 Convirtiendo relación: ${relationship.id}`);
  console.log(
    `   Source: ${relationship.source}, Target: ${relationship.target}`
  );
  console.log(`   Tipo: ${relationship.relationship}`);
  console.log(
    `   Cardinalidad - Source: "${relationship.sourceMultiplicity}", Target: "${relationship.targetMultiplicity}"`
  );

  const link = {
    id: relationship.id,
    type: "standard.Link",
    source: { id: relationship.source },
    target: { id: relationship.target },
    labels: [] as Array<{
      position: number;
      attrs: {
        text?: {
          text: string;
          fill: string;
          fontSize: number;
          fontWeight?: string;
          fontStyle?: string;
        };
        rect?: {
          fill: string;
          stroke: string;
          strokeWidth: number;
          rx: number;
          ry: number;
        };
      };
    }>,
    attrs: {
      line: {} as {
        stroke?: string;
        strokeWidth?: number;
        fill?: string;
        strokeDasharray?: string;
        targetMarker?: {
          type: string;
          d: string;
          fill: string;
          stroke?: string;
          strokeWidth?: number;
        };
        sourceMarker?: {
          type: string;
          d: string;
          fill: string;
          stroke?: string;
          strokeWidth?: number;
        };
      },
    },
  };

  // Agregar etiqueta de relación si existe
  if (relationship.label) {
    link.labels.push({
      position: 0.5, // Centro de la línea
      attrs: {
        text: {
          text: truncateText(relationship.label, 10), // Truncar etiquetas largas
          fill: "#333",
          fontSize: 12,
          fontWeight: "bold",
        },
        rect: {
          fill: "white",
          stroke: "#333",
          strokeWidth: 1,
          rx: 3,
          ry: 3,
        },
      },
    });
  }

  // Agregar multiplicidad en el extremo source (origen)
  // NOTA: sourceMultiplicity se muestra cerca del elemento SOURCE
  if (relationship.sourceMultiplicity) {
    link.labels.push({
      position: 0.1, // Cerca del extremo source (10% desde el inicio)
      attrs: {
        text: {
          text: truncateText(relationship.sourceMultiplicity, 8),
          fill: "#000",
          fontSize: 12,
          fontWeight: "bold",
        },
        rect: {
          fill: "white",
          stroke: "#333",
          strokeWidth: 1,
          rx: 3,
          ry: 3,
        },
      },
    });
  }

  // Agregar multiplicidad en el extremo target (destino)
  // NOTA: targetMultiplicity se muestra cerca del elemento TARGET
  if (relationship.targetMultiplicity) {
    link.labels.push({
      position: 0.9, // Cerca del extremo target (90% desde el inicio)
      attrs: {
        text: {
          text: truncateText(relationship.targetMultiplicity, 8),
          fill: "#000",
          fontSize: 12,
          fontWeight: "bold",
        },
        rect: {
          fill: "white",
          stroke: "#333",
          strokeWidth: 1,
          rx: 3,
          ry: 3,
        },
      },
    });
  }

  // Configurar el estilo de la línea según el tipo de relación
  switch (relationship.relationship) {
    case "aggregation":
      link.attrs.line = {
        stroke: "#9C27B0",
        strokeWidth: 2,
        sourceMarker: {
          type: "path",
          d: "M 15 0 L 7.5 -7.5 L 0 0 L 7.5 7.5 z",
          fill: "white",
          stroke: "#9C27B0",
          strokeWidth: 2,
        },
      };
      break;
    case "composition":
      link.attrs.line = {
        stroke: "#673AB7",
        strokeWidth: 2,
        sourceMarker: {
          type: "path",
          d: "M 15 0 L 7.5 -7.5 L 0 0 L 7.5 7.5 z",
          fill: "#673AB7",
        },
      };
      break;
    case "generalization":
      link.attrs.line = {
        stroke: "#3F51B5",
        strokeWidth: 2,
        targetMarker: {
          type: "path",
          d: "M 10 -5 0 0 10 5 z",
          fill: "white",
          stroke: "#3F51B5",
          strokeWidth: 2,
        },
      };
      break;
    case "dependency":
      link.attrs.line = {
        stroke: "#607D8B",
        strokeWidth: 2,
        strokeDasharray: "5,5",
        targetMarker: {
          type: "path",
          d: "M 10 0 L 0 5 L 10 10 z",
          fill: "#607D8B",
        },
      };
      break;
    case "realization":
      link.attrs.line = {
        stroke: "#00BCD4",
        strokeWidth: 2,
        strokeDasharray: "5,5",
        targetMarker: {
          type: "path",
          d: "M 10 -5 0 0 10 5 z",
          fill: "white",
          stroke: "#00BCD4",
          strokeWidth: 2,
        },
      };
      break;
    default: // association
      link.attrs.line = {
        stroke: "#FF5722",
        strokeWidth: 2,
        targetMarker: {
          type: "path",
          // d: "M 10 0 L 0 5 L 10 10 z",
          // d: "M 20 -10 0 0 20 10 Z",
          d: "M 10 -5 0 0 10 5 z",
          fill: "#FF5722",
        },
      };
  }

  return link;
};
