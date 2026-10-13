-- Tipo de impuesto por renglon de factura manual / de POS externo: IVA (por defecto, como antes),
-- INC (impuesto al consumo, ej. restaurantes 8%), EXEMPT o EXCLUDED. Lo necesita la factura
-- electronica para mandar el codigo de tributo correcto (01 IVA, 04 INC) y el CUFE (ValImp2).
ALTER TABLE "manual_invoice_items" ADD COLUMN "taxType" TEXT NOT NULL DEFAULT 'IVA';
