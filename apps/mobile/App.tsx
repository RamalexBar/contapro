import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { initLocalDatabase } from "./src/lib/local-db/sqlite";

export default function App() {
  useEffect(() => {
    initLocalDatabase().catch((err) => console.warn("No se pudo inicializar SQLite local:", err));
  }, []);

  return (
    <>
      <StatusBar style="auto" />
      <RootNavigator />
    </>
  );
}
