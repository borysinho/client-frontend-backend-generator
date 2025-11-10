/**
 * Trunca un texto si es muy largo y agrega "..." al final
 * @param text Texto a truncar
 * @param maxLength Longitud máxima permitida
 * @returns Texto truncado si es necesario
 */
export const truncateText = (text: string, maxLength: number = 20): string => {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + "...";
};
