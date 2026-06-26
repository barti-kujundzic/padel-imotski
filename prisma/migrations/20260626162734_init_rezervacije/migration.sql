-- CreateTable
CREATE TABLE "Rezervacija" (
    "id" SERIAL NOT NULL,
    "ime" TEXT NOT NULL,
    "telefon" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "datum" TEXT NOT NULL,
    "vrijeme" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "potvrdjeno" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rezervacija_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rezervacija_token_key" ON "Rezervacija"("token");
