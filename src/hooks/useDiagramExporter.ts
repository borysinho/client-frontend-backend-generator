import { useCallback } from "react";

interface UseDiagramExporterProps {
  diagramName: string;
  currentDiagramId: string | null;
  urlDiagramId: string | undefined;
  addNotification: (
    type: "success" | "error" | "info" | "warning",
    title: string,
    message: string,
    autoClose?: boolean,
    duration?: number
  ) => void;
}

export const useDiagramExporter = ({
  diagramName,
  currentDiagramId,
  urlDiagramId,
  addNotification,
}: UseDiagramExporterProps) => {
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

  return {
    handleExport,
  };
};
