/*
  Warnings:

  - You are about to drop the column `address` on the `Buyer` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[buyerId,isDefault]` on the table `Address` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `buyerId` to the `Address` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Address" ADD COLUMN     "buyerId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Buyer" DROP COLUMN "address";

-- CreateIndex
CREATE UNIQUE INDEX "Address_buyerId_isDefault_key" ON "Address"("buyerId", "isDefault");

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
