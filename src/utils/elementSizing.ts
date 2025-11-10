import type { CustomElement } from "../types";

/**
 * Calcula el ancho óptimo para un elemento UML basado en su contenido
 * @param element El elemento UML
 * @returns El ancho calculado en píxeles
 */
export const calculateElementWidth = (
  element: Partial<CustomElement>
): number => {
  const minWidth = 120; // Ancho mínimo
  const maxWidth = 300; // Ancho máximo
  const charWidth = 8; // Ancho aproximado por carácter en monospace
  const padding = 16; // Padding horizontal total

  // Encontrar el texto más largo
  let maxTextLength = element.className?.length || 0;

  if (element.attributes) {
    element.attributes.forEach((attr) => {
      maxTextLength = Math.max(maxTextLength, attr.length);
    });
  }

  if (element.methods) {
    element.methods.forEach((method) => {
      maxTextLength = Math.max(maxTextLength, method.length);
    });
  }

  // Calcular ancho basado en el texto más largo
  const calculatedWidth = maxTextLength * charWidth + padding;

  // Aplicar límites mínimo y máximo
  return Math.max(minWidth, Math.min(maxWidth, calculatedWidth));
};

/**
 * Calcula el alto óptimo para un elemento UML basado en su contenido
 * @param element El elemento UML
 * @returns El alto calculado en píxeles
 */
export const calculateElementHeight = (
  element: Partial<CustomElement>
): number => {
  const baseHeight = 80; // Alto mínimo para el header
  const lineHeight = 18; // Alto aproximado por línea
  const padding = 16; // Padding vertical total

  let lineCount = 1; // Al menos el nombre de la clase

  // Contar líneas de atributos
  if (element.attributes && element.attributes.length > 0) {
    lineCount += element.attributes.length;
  }

  // Contar líneas de métodos
  if (element.methods && element.methods.length > 0) {
    lineCount += element.methods.length;
  }

  // Para interfaces, solo mostrar métodos
  if (element.elementType === "interface") {
    lineCount = 1 + (element.methods?.length || 0);
  }

  // Calcular alto total
  const calculatedHeight = lineCount * lineHeight + padding;

  // Asegurar un alto mínimo
  return Math.max(calculatedHeight, baseHeight);
};
