// Entrada propia de la app: con pnpm, expo/AppEntry.js vive dentro de node_modules/.pnpm y su "../../App" no apunta a
// esta carpeta. registerRootComponent hace lo mismo que AppEntry (AppRegistry + Expo Go / build nativo).
import { registerRootComponent } from "expo";
import App from "./App";

registerRootComponent(App);
