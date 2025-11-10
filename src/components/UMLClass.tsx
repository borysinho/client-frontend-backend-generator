import React from "react";
import type { CustomElement } from "../types";

interface UMLClassProps {
  element: CustomElement;
  isSelected?: boolean;
  onSelect?: (element: CustomElement) => void;
}

export const UMLClass: React.FC<UMLClassProps> = ({
  element,
  isSelected = false,
  onSelect,
}) => {
  // Determinar el tipo de elemento basado en su contenido
  const getElementType = () => {
    // Usar el tipo fijo del elemento en lugar de determinar dinámicamente
    return element.elementType;
  };

  const elementType = getElementType();

  const getElementStyle = () => {
    switch (elementType) {
      case "interface":
        return {
          border: "2px solid #2196F3",
          background: "#e3f2fd",
        };
      case "enumeration":
        return {
          border: "2px solid #795548",
          background: "#efebe9",
        };
      case "package":
        return {
          border: "2px solid #3F51B5",
          background: "#e8eaf6",
        };
      case "note":
        return {
          border: "2px solid #FFC107",
          background: "#fffde7",
          fontFamily: "Arial, sans-serif",
        };
      default:
        return {
          border: "2px solid #333",
          background: "white",
        };
    }
  };

  const getHeaderStyle = () => {
    switch (elementType) {
      case "interface":
        return { background: "#bbdefb" };
      case "enumeration":
        return { background: "#d7ccc8" };
      case "package":
        return { background: "#c5cae9" };
      case "note":
        return { background: "#fff9c4" };
      default:
        return { background: "#e3f2fd" };
    }
  };

  const style = getElementStyle();
  const headerStyle = getHeaderStyle();

  return (
    <div
      style={{
        ...style,
        borderRadius: "8px",
        fontFamily: elementType === "note" ? "Arial, sans-serif" : "monospace",
        fontSize: "12px",
        overflow: "hidden", // Cambiado a "hidden" para permitir truncamiento
        boxShadow: isSelected
          ? "0 0 0 3px #007bff, 2px 2px 5px rgba(0,0,0,0.1)"
          : "2px 2px 5px rgba(0,0,0,0.1)",
        width: `${element.width}px`, // Ancho dinámico basado en contenido
        maxWidth: "300px", // Máximo ancho permitido
        minWidth: "120px", // Mínimo ancho permitido
        cursor: "inherit", // Heredar cursor del elemento padre (JointJS)
        userSelect: "none", // Evitar selección de texto
        transition: "box-shadow 0.2s",
      }}
      onClick={() => onSelect?.(element)}
    >
      {/* Nombre del elemento */}
      <div
        style={{
          ...headerStyle,
          padding: "8px",
          fontWeight: "bold",
          textAlign: "center",
          borderBottom: "1px solid #333",
          fontStyle:
            elementType === "interface" || elementType === "enumeration"
              ? "italic"
              : "normal",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {/* Estereotipo (si existe) */}
        {element.stereotype && (
          <div
            style={{
              fontSize: "10px",
              fontStyle: "normal",
              marginBottom: "2px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "100%",
            }}
            title={element.stereotype}
          >
            {element.stereotype}
          </div>
        )}

        {/* Indicadores de tipo + nombre */}
        <div
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "100%",
          }}
          title={`${elementType === "interface" ? "«interface» " : ""}
                ${elementType === "enumeration" ? "«enumeration» " : ""}
                ${elementType === "package" ? "📦 " : ""}${element.className}`}
        >
          {elementType === "interface" && "«interface» "}
          {elementType === "enumeration" && "«enumeration» "}
          {elementType === "package" && "📦 "}
          {element.className}
        </div>
      </div>

      {/* Contenido basado en el tipo */}
      {elementType === "interface" && (
        <div style={{ padding: "4px 8px", overflow: "hidden" }}>
          {element.methods?.map((method, index) => (
            <div
              key={index}
              style={{
                margin: "2px 0",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "100%",
              }}
              title={method}
            >
              {method}
            </div>
          ))}
        </div>
      )}

      {elementType === "enumeration" && (
        <div style={{ padding: "8px", overflow: "hidden" }}>
          {element.attributes?.map((value, index) => (
            <div
              key={index}
              style={{
                margin: "4px 0",
                textAlign: "center",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "100%",
              }}
              title={value}
            >
              {value}
            </div>
          ))}
        </div>
      )}

      {elementType === "note" && (
        <div
          style={{
            padding: "8px",
            fontSize: "11px",
            lineHeight: "1.4",
            overflow: "hidden",
          }}
        >
          {element.attributes?.map((line, index) => (
            <div
              key={index}
              style={{
                margin: "2px 0",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "100%",
              }}
              title={line}
            >
              {line}
            </div>
          ))}
        </div>
      )}

      {elementType === "package" && (
        <div
          style={{
            padding: "20px",
            textAlign: "center",
            color: "#666",
            wordBreak: "break-all",
            overflowWrap: "break-word",
          }}
        >
          Paquete vacío
        </div>
      )}

      {elementType === "class" && (
        <>
          {/* Atributos */}
          <div
            style={{
              padding: "4px 8px",
              borderBottom:
                element.methods && element.methods.length > 0
                  ? "1px solid #ddd"
                  : "none",
              minHeight: "20px",
              overflow: "hidden",
            }}
          >
            {element.attributes?.map((attr, index) => (
              <div
                key={index}
                style={{
                  margin: "2px 0",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "100%",
                }}
                title={attr}
              >
                {attr}
              </div>
            ))}
          </div>

          {/* Métodos */}
          {element.methods && element.methods.length > 0 && (
            <div style={{ padding: "4px 8px", overflow: "hidden" }}>
              {element.methods.map((method, index) => (
                <div
                  key={index}
                  style={{
                    margin: "2px 0",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "100%",
                  }}
                  title={method}
                >
                  {method}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
