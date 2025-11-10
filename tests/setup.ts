// tests/setup.ts
import { jest } from "@jest/globals";
import "@testing-library/jest-dom";

// Configuración global para pruebas
process.env.NODE_ENV = "test";

// Mock para console.log en pruebas
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// Configuración de Jest para async/await
jest.setTimeout(10000);
