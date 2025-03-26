/*
  Warnings:

  - A unique constraint covering the columns `[BuyerId]` on the table `Buyer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[sellerId]` on the table `Seller` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `BuyerId` to the `Buyer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sellerId` to the `Seller` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Buyer" DROP CONSTRAINT "Buyer_userId_fkey";

-- DropForeignKey
ALTER TABLE "Seller" DROP CONSTRAINT "Seller_userId_fkey";

-- AlterTable
ALTER TABLE "Buyer" ADD COLUMN     "BuyerId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Seller" ADD COLUMN     "sellerId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Buyer_BuyerId_key" ON "Buyer"("BuyerId");

-- CreateIndex
CREATE UNIQUE INDEX "Seller_sellerId_key" ON "Seller"("sellerId");

-- AddForeignKey
ALTER TABLE "Buyer" ADD CONSTRAINT "Buyer_BuyerId_fkey" FOREIGN KEY ("BuyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seller" ADD CONSTRAINT "Seller_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
