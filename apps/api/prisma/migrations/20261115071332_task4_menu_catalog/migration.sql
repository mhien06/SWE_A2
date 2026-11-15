-- CreateEnum
CREATE TYPE "ProductOptionType" AS ENUM ('SIZE', 'TOPPING');

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "basePrice" DECIMAL(12,2) NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOption" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "type" "ProductOptionType" NOT NULL,
    "name" TEXT NOT NULL,
    "additionalPrice" DECIMAL(12,2) NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProductOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductOption_productId_type_idx" ON "ProductOption"("productId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ProductOption_productId_type_name_key" ON "ProductOption"("productId", "type", "name");

-- AddForeignKey
ALTER TABLE "ProductOption" ADD CONSTRAINT "ProductOption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
