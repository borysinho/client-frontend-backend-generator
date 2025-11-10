import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AIBot } from "../../src/components/AIBot";

// Mock del servicio de IA
jest.mock("../../src/services/AIService", () => ({
  AIService: jest.fn().mockImplementation(() => ({
    createClass: jest.fn().mockResolvedValue({
      success: true,
      data: {
        className: "Usuario",
        attributes: ["- nombre: String", "- email: String"],
        methods: ["+ login(): boolean"],
        stereotype: ""
      }
    }),
    relateClasses: jest.fn().mockResolvedValue({
      success: true,
      data: {
        relationshipType: "association",
        sourceClass: "Usuario",
        targetClass: "Pedido",
        multiplicity: { source: "1", target: "*" },
        description: "Un usuario puede tener muchos pedidos"
      }
    }),
    generateDiagram: jest.fn().mockResolvedValue({
      success: true,
      data: {
        classes: [
          {
            className: "Usuario",
            attributes: ["- nombre: String"],
            methods: ["+ login(): boolean"]
          }
        ],
        relationships: []
      }
    })
  }))
}));

const mockOnCreateClass = jest.fn();
const mockOnCreateRelationship = jest.fn();
const mockOnGenerateDiagram = jest.fn();
const mockOnClose = jest.fn();

const defaultProps = {
  onCreateClass: mockOnCreateClass,
  onCreateRelationship: mockOnCreateRelationship,
  onGenerateDiagram: mockOnGenerateDiagram,
  existingClasses: ["Usuario", "Producto"],
  isVisible: true,
  onClose: mockOnClose,
};

describe("AIBot Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("debe renderizarse cuando isVisible es true", () => {
    render(<AIBot {...defaultProps} />);

    expect(screen.getByText("🤖 Asistente IA")).toBeInTheDocument();
    expect(screen.getByText("Crear Clase")).toBeInTheDocument();
    expect(screen.getByText("Crear Relación")).toBeInTheDocument();
    expect(screen.getByText("Generar Diagrama")).toBeInTheDocument();
  });

  test("no debe renderizarse cuando isVisible es false", () => {
    render(<AIBot {...defaultProps} isVisible={false} />);

    expect(screen.queryByText("🤖 Asistente IA")).not.toBeInTheDocument();
  });

  test("debe mostrar el placeholder correcto para crear clase", () => {
    render(<AIBot {...defaultProps} />);

    const input = screen.getByPlaceholderText('Describe la clase que quieres crear (ej: "Una clase Usuario con nombre, email y métodos para login")');
    expect(input).toBeInTheDocument();
  });

  test("debe cambiar el placeholder cuando se selecciona una acción diferente", () => {
    render(<AIBot {...defaultProps} />);

    // Hacer click en "Crear Relación"
    fireEvent.click(screen.getByText("Crear Relación"));

    const input = screen.getByPlaceholderText('Describe la relación entre clases (ej: "Un Usuario tiene muchos Pedidos")');
    expect(input).toBeInTheDocument();
  });

  test("debe llamar onClose cuando se hace click en cerrar", () => {
    render(<AIBot {...defaultProps} />);

    const closeButton = screen.getByText("✕");
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test("debe mostrar mensaje de carga durante el procesamiento", async () => {
    render(<AIBot {...defaultProps} />);

    const input = screen.getByPlaceholderText('Describe la clase que quieres crear (ej: "Una clase Usuario con nombre, email y métodos para login")');
    const submitButton = screen.getByText("Enviar");

    // Escribir en el input
    fireEvent.change(input, { target: { value: "Crea una clase Producto" } });

    // Hacer click en enviar
    fireEvent.click(submitButton);

    // Verificar que se muestra el mensaje de carga
    expect(screen.getByText("Procesando...")).toBeInTheDocument();

    // Esperar a que termine el procesamiento
    await waitFor(() => {
      expect(screen.queryByText("Procesando...")).not.toBeInTheDocument();
    });
  });

  test("debe llamar onCreateClass cuando se crea una clase exitosamente", async () => {
    render(<AIBot {...defaultProps} />);

    const input = screen.getByPlaceholderText('Describe la clase que quieres crear (ej: "Una clase Usuario con nombre, email y métodos para login")');
    const submitButton = screen.getByText("Enviar");

    // Escribir en el input
    fireEvent.change(input, { target: { value: "Crea una clase Producto" } });

    // Hacer click en enviar
    fireEvent.click(submitButton);

    // Esperar a que se complete la operación
    await waitFor(() => {
      expect(mockOnCreateClass).toHaveBeenCalledWith({
        className: "Usuario",
        attributes: ["- nombre: String", "- email: String"],
        methods: ["+ login(): boolean"],
        stereotype: ""
      });
    });
  });

  test("debe mostrar mensaje de error cuando falla la creación", async () => {
    // Mock de error
    const { AIService } = require("../../src/services/AIService");
    AIService.mockImplementation(() => ({
      createClass: jest.fn().mockResolvedValue({
        success: false,
        error: "Error de conexión"
      })
    }));

    render(<AIBot {...defaultProps} />);

    const input = screen.getByPlaceholderText('Describe la clase que quieres crear (ej: "Una clase Usuario con nombre, email y métodos para login")');
    const submitButton = screen.getByText("Enviar");

    // Escribir en el input
    fireEvent.change(input, { target: { value: "Crea una clase Producto" } });

    // Hacer click en enviar
    fireEvent.click(submitButton);

    // Esperar a que aparezca el mensaje de error
    await waitFor(() => {
      expect(screen.getByText("❌ Error de conexión: Error de conexión")).toBeInTheDocument();
    });
  });

  test("debe limpiar el input después de enviar", async () => {
    render(<AIBot {...defaultProps} />);

    const input = screen.getByPlaceholderText('Describe la clase que quieres crear (ej: "Una clase Usuario con nombre, email y métodos para login")');
    const submitButton = screen.getByText("Enviar");

    // Escribir en el input
    fireEvent.change(input, { target: { value: "Crea una clase Producto" } });

    // Verificar que el input tiene el valor
    expect(input).toHaveValue("Crea una clase Producto");

    // Hacer click en enviar
    fireEvent.click(submitButton);

    // Esperar a que se complete y verificar que el input se limpió
    await waitFor(() => {
      expect(input).toHaveValue("");
    });
  });
});