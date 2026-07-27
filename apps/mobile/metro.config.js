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
// pnpm usa symlinks + estructura no-jerarquica; esto evita que Metro intente resolver
// duplicados de paquetes por el hoisting parcial de pnpm.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
