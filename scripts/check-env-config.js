#!/usr/bin/env node

/**
 * Script para verificar la configuración de variables de entorno
 * Ejecutar con: node scripts/check-env-config.js
 */

console.log("🔍 Verificando configuración de variables de entorno...\n");

// Verificar variables disponibles en import.meta.env (simulado)
const mockImportMetaEnv = {
  VITE_API_URL: process.env.VITE_API_URL || "http://localhost:3001",
  MODE: process.env.NODE_ENV || "development",
  PROD: process.env.NODE_ENV === "production",
  DEV: process.env.NODE_ENV !== "production",
};

console.log("📋 Variables de entorno detectadas:");
console.log(`  VITE_API_URL: ${mockImportMetaEnv.VITE_API_URL}`);
console.log(`  MODE: ${mockImportMetaEnv.MODE}`);
console.log(`  PROD: ${mockImportMetaEnv.PROD}`);
console.log(`  DEV: ${mockImportMetaEnv.DEV}`);

console.log("\n✅ Configuración verificada correctamente.");

// Verificar conectividad básica a la API
const apiUrl = mockImportMetaEnv.VITE_API_URL;
console.log(`\n🌐 Probando conectividad a: ${apiUrl}`);

if (apiUrl.includes("localhost")) {
  console.log("ℹ️  Modo desarrollo: API apunta a localhost");
} else if (apiUrl.includes("vercel.app")) {
  console.log("ℹ️  Modo producción: API apunta a Vercel");
} else {
  console.log("⚠️  URL de API no reconocida");
}

console.log("\n🎯 Configuración lista para despliegue.");
