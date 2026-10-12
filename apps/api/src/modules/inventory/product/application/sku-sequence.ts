/** Referencia comparada sin mayusculas ni espacios de borde ("prod-0001" choca con "PROD-0001"). */
export function normalizeSkuKey(value: string): string {
  return value.trim().toLocaleLowerCase("es-CO");
}

/**
 * Generador de referencias PROD-0001, PROD-0002... que salta las ya usadas -- para productos que
 * llegan sin referencia propia (importacion desde Excel, productos nuevos de una factura de compra).
 * Cada referencia que entrega queda marcada como usada.
 */
export function createSkuSequence(takenSkus: Iterable<string>): () => string {
  const used = new Set(Array.from(takenSkus, normalizeSkuKey));
  let sequence = 0;
  return () => {
    let candidate: string;
    do {
      sequence += 1;
      candidate = `PROD-${String(sequence).padStart(4, "0")}`;
    } while (used.has(normalizeSkuKey(candidate)));
    used.add(normalizeSkuKey(candidate));
    return candidate;
  };
}
