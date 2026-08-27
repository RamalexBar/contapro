const STOPWORDS = new Set([
  "de", "del", "la", "el", "los", "las", "un", "una", "unos", "unas",
  "en", "a", "con", "por", "para", "y", "o", "al", "que", "su",
]);

/** Quita tildes/diacriticos (NFD + strip de marcas combinantes, U+0300-U+036F) para que "numero"
 * con o sin tilde compare igual -- las descripciones de banco suelen venir sin tildes. */
function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function tokenize(value: string): Set<string> {
  const normalized = stripDiacritics(value.toLowerCase()).replace(/[^a-z0-9\s]/g, " ");
  const tokens = normalized.split(/\s+/).filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  return new Set(tokens);
}

/**
 * Similitud de texto entre dos descripciones (0..1), por superposicion de palabras (indice de
 * Jaccard: interseccion / union de los conjuntos de tokens). Pensada para comparar la
 * descripcion de una transaccion bancaria contra la de un comprobante contable -- ninguna de las
 * dos sigue un formato fijo, asi que una comparacion por palabras compartidas es mas robusta que
 * un match exacto de texto. Sin tildes, sin mayusculas, sin puntuacion, sin conectores comunes en
 * español (stopwords) que aparecerian en casi cualquier par y no aportarian señal.
 */
export function descriptionSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const tokensA = tokenize(a ?? "");
  const tokensB = tokenize(b ?? "");
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersectionSize = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersectionSize++;
  }
  const unionSize = tokensA.size + tokensB.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}
