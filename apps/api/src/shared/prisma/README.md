# Convencion de repositorios Prisma (aislamiento multi-tenant)

Todo repositorio de un modulo de negocio debe importar `prisma` desde `./prisma-client.ts`
(nunca directamente `@erp/database`). Ese cliente ya trae la extension de tenant
(`tenant.extension.ts`) que inyecta `companyId` automaticamente en:

- `findMany`, `findFirst`, `findFirstOrThrow`, `count`, `aggregate`, `groupBy`
- `updateMany`, `deleteMany`
- `create`, `createMany`

## Lo que NO cubre la extension (y como resolverlo)

`findUnique`, `update`, `delete` y `upsert` por `id` (o por cualquier clave unica) **no** quedan
cubiertos — no estan en la lista de operaciones que la extension intercepta. Prisma tampoco
permite mutarles el `where` con campos extra sin que dejen de ser una busqueda por indice unico.
Por eso, para operar por `id`, todo repositorio debe seguir este patron obligatorio:

```ts
async updateOne(id: string, data: Partial<Product>) {
  const existing = await prisma.product.findFirst({ where: { id, companyId: getTenantContext().companyId } });
  if (!existing) throw new NotFoundError("Product", id);
  return prisma.product.update({ where: { id }, data });
}
```

El `findFirst` ya queda filtrado automaticamente por la extension (companyId se inyecta), así
que basta con pasar `id` explicito ademas para acotar a una sola fila antes de mutar por `id`.

**`upsert` por una clave unica compuesta** (ej. `@@unique([companyId, deviceIdentifier])`) es
distinto: al incluir `companyId` como parte de la clave del `where`, ya queda acotado al tenant
sin necesitar un `findFirst` previo — pero el bloque `create` SI necesita `companyId` explicito
igual (la extension no lo inyecta en `upsert`, solo en `create`/`createMany` sueltos):

```ts
await prisma.syncDevice.upsert({
  where: { companyId_deviceIdentifier: { companyId, deviceIdentifier } },
  create: { companyId, deviceIdentifier, /* ... */ },
  update: { /* ... */ },
});
```

## Hardening de fase 2 (no implementado aun)

Postgres Row-Level Security (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + politica
`USING (company_id = current_setting('app.current_company_id')::uuid)`) como cinturon de
seguridad adicional para accesos directos a la base de datos que no pasen por esta capa.
