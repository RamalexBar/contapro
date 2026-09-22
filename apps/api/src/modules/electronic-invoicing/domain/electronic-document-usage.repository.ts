/**
 * Consumo aproximado de la bolsa de documentos de Factus por la empresa en el mes calendario en
 * curso -- decision de negocio del 2026-09-21 (ver memoria factus-pricing-and-caps): cada plan
 * tiene un tope de documentos DIAN/mes (Plan.maxElectronicDocumentsPerMonth) para que un cliente
 * de alto volumen no le cueste a Contapro en Factus mas de lo que paga de suscripcion.
 *
 * Es una APROXIMACION, no un contador exacto de lo que Factus factura: cuenta documentos en
 * estado ACCEPTED/REJECTED (es decir, que llegaron a intentarse contra un proveedor tecnologico)
 * de los 5 tipos que comparten la misma bolsa (factura, notas credito/debito, documento soporte,
 * nomina) -- no distingue si ese intento especifico paso por FACTUS o por el envio DIRECT (que no
 * consume la bolsa). En la practica esto no importa: una empresa solo tiene un proveedor activo
 * a la vez, asi que si esta en FACTUS todos sus documentos ACCEPTED/REJECTED del mes salieron de
 * la bolsa.
 */
export interface IElectronicDocumentUsageRepository {
  countThisMonth(): Promise<number>;
}
