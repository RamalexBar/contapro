// Configuracion de Metro para monorepo pnpm: permite que la app Expo resuelva
// paquetes compartidos (@erp/shared-types, @erp/shared-utils) fuera de apps/mobile.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// Con pnpm (modo aislado) cada paquete trae sus dependencias en su propia carpeta de .pnpm: Metro tiene que poder
// buscar hacia arriba desde el archivo que pide el modulo; si no, no encuentra nada (la app no compilaba para el celular).
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
