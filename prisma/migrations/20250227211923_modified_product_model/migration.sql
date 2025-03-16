/*
  Warnings:

  - You are about to drop the column `bulkUploaded` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `rating` on the `Product` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[productId]` on the table `ProductDetails` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `category` on the `Product` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `hemline` to the `ProductVariant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `length` to the `ProductVariant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `neck` to the `ProductVariant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `occasion` to the `ProductVariant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pattern` to the `ProductVariant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sleeveLength` to the `ProductVariant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `types` to the `ProductVariant` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('MENS', 'WOMENS', 'KIDS', 'OTHER');

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_sellerId_fkey";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "bulkUploaded",
DROP COLUMN "rating",
ADD COLUMN     "bulkUpload" TEXT,
DROP COLUMN "category",
ADD COLUMN     "category" "ProductCategory" NOT NULL;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "hemline" TEXT NOT NULL,
ADD COLUMN     "length" TEXT NOT NULL,
ADD COLUMN     "neck" TEXT NOT NULL,
ADD COLUMN     "occasion" TEXT NOT NULL,
ADD COLUMN     "pattern" TEXT NOT NULL,
ADD COLUMN     "sleeveLength" TEXT NOT NULL,
ADD COLUMN     "types" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Specification" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Specification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UpperWear" (
    "id" TEXT NOT NULL,
    "specificationId" TEXT NOT NULL,
    "length" TEXT NOT NULL,
    "chest" TEXT NOT NULL,
    "shoulder" TEXT NOT NULL,
    "sleeve" TEXT NOT NULL,
    "neck" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UpperWear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BottomWear" (
    "id" TEXT NOT NULL,
    "specificationId" TEXT NOT NULL,
    "length" TEXT NOT NULL,
    "waist" TEXT NOT NULL,
    "hip" TEXT NOT NULL,
    "thigh" TEXT NOT NULL,
    "knee" TEXT NOT NULL,
    "ankle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BottomWear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LowerWear" (
    "id" TEXT NOT NULL,
    "specificationId" TEXT NOT NULL,
    "length" TEXT NOT NULL,
    "waist" TEXT NOT NULL,
    "hip" TEXT NOT NULL,
    "thigh" TEXT NOT NULL,
    "knee" TEXT NOT NULL,
    "ankle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LowerWear_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Specification_productId_key" ON "Specification"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "UpperWear_specificationId_key" ON "UpperWear"("specificationId");

-- CreateIndex
CREATE UNIQUE INDEX "BottomWear_specificationId_key" ON "BottomWear"("specificationId");

-- CreateIndex
CREATE UNIQUE INDEX "LowerWear_specificationId_key" ON "LowerWear"("specificationId");

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "Product"("category");

-- CreateIndex
CREATE UNIQUE INDEX "ProductDetails_productId_key" ON "ProductDetails"("productId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Specification" ADD CONSTRAINT "Specification_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpperWear" ADD CONSTRAINT "UpperWear_specificationId_fkey" FOREIGN KEY ("specificationId") REFERENCES "Specification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BottomWear" ADD CONSTRAINT "BottomWear_specificationId_fkey" FOREIGN KEY ("specificationId") REFERENCES "Specification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LowerWear" ADD CONSTRAINT "LowerWear_specificationId_fkey" FOREIGN KEY ("specificationId") REFERENCES "Specification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
