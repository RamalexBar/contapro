/*
  Warnings:

  - Added the required column `subtotal` to the `purchases` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "purchases" ADD COLUMN     "subtotal" DECIMAL(14,2) NOT NULL,
ADD COLUMN     "taxTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
ALTER COLUMN "status" SET DEFAULT 'REGISTERED';
