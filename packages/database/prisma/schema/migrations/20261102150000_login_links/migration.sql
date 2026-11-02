-- Enlaces de entrada de un solo uso (boton "Entrar a Contapro" desde Cajapro): vencen en minutos y se marcan usados.
CREATE TABLE "login_links" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "login_links_tokenHash_key" ON "login_links"("tokenHash");

-- CreateIndex
CREATE INDEX "login_links_userId_idx" ON "login_links"("userId");

-- AddForeignKey
ALTER TABLE "login_links" ADD CONSTRAINT "login_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
