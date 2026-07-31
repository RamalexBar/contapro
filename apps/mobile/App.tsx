import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { initLocalDatabase } from "./src/lib/local-db/sqlite";
import { startBackgroundSync } from "./src/lib/sync/sync-engine";

export default function App() {
  useEffect(() => {
    initLocalDatabase().catch((err) => console.warn("No se pudo inicializar SQLite local:", err));
    const stopSync = startBackgroundSync();
    return stopSync;
  }, []);

  return (
    <>
      <StatusBar style="auto" />
      <RootNavigator />
    </>
  );
}
