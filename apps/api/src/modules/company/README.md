# Modulo: Perfil de empresa (datos fiscales DIAN)

Estado: `GET/PUT /company/profile` lee/edita los datos fiscales de la empresa (tipo de documento,
DV, razon social, responsabilidad tributaria, regimen tributario, direccion, municipio/
departamento) — campos agregados a `Company` inspirados en el wizard de onboarding "solo
facturacion" de Alegra. No existia ningun endpoint de perfil de empresa antes de este modulo:
`RegisterCompanyUseCase` (`modules/auth`) solo escribe `name`/`legalName`/`nit`/`email` al
registrar la cuenta.

## Implementado

1. `GET /company/profile` (permiso `electronic-invoicing.read`, mismo permiso ya usado para
   `GET /electronic-invoicing/provider-settings` — no se creo un permiso `company.*` nuevo solo
   para esto): devuelve el perfil completo + `complete`/`missingFields` (ver
   `application/is-company-profile-complete.ts`, funcion pura).
2. `PUT /company/profile` (permiso `electronic-invoicing.manage`): actualiza los campos, strings
   planos opcionales sin catalogo/enum (mismo criterio que los 7 campos `dian*` de `Customer`,
   ver `packages/database/prisma/schema/customers.prisma`) — este codebase deliberadamente no
   inventa catalogos DIAN sin verificar contra la fuente real. Audita `COMPANY_PROFILE_UPDATED`.
3. `isCompanyProfileComplete` es usado tambien por `modules/manual-invoicing` para exigir el perfil
   completo antes de la primera factura manual (ver su README) — exportado como
   `companyProfileRepo` desde `company.container.ts` para que ese modulo lo importe sin ciclos.

## Limitaciones conocidas

- **No se envian a MATIAS**: el payload de `POST /invoice` de MATIAS
  (`modules/electronic-invoicing/infrastructure/matias-invoicing-client.ts`) no tiene objeto
  seller/emisor — la identidad del emisor vive en la cuenta/token de MATIAS, configurada una vez
  en su propio dashboard. Estos campos sirven para (1) el gate de completitud antes de la primera
  factura manual, (2) futuro enriquecimiento del XML UBL del camino DIRECT (`ubl-invoice-xml-builder.ts`
  solo usa `nit`/`legalName` del emisor hoy), (3) datos de cumplimiento/visualizacion.
- **Sin catalogo DANE de municipio/departamento**: `municipality`/`department` son texto libre que
  el contador escribe a mano, igual que `municipalityCode` (codigo DANE) ya existente — no hay
  ningun catalogo de referencia en este codebase para validarlos contra.
