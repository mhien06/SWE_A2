-- CreateTable
CREATE TABLE "ProductAvailabilityChange" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "isAvailable" BOOLEAN NOT NULL,
    "reason" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAvailabilityChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductAvailabilityChange_productId_changedAt_idx" ON "ProductAvailabilityChange"("productId", "changedAt");

-- AddForeignKey
ALTER TABLE "ProductAvailabilityChange" ADD CONSTRAINT "ProductAvailabilityChange_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAvailabilityChange" ADD CONSTRAINT "ProductAvailabilityChange_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
