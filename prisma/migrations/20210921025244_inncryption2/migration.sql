/*
  Warnings:

  - You are about to drop the column `hashedToken` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `protectedKeychain` on the `User` table. All the data in the column will be lost.
  - Added the required column `encryptedKeychain` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `publicKeychain` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "hashedToken",
DROP COLUMN "protectedKeychain",
ADD COLUMN     "encryptedKeychain" JSONB NOT NULL,
ADD COLUMN     "publicKeychain" JSONB NOT NULL,
ADD COLUMN     "salt" INTEGER[],
ALTER COLUMN "avatar" SET DEFAULT E'https://cdn.nekos.life/avatar/avatar_19.png';

-- CreateTable
CREATE TABLE "_UsersToUsers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_UsersToUsers_AB_unique" ON "_UsersToUsers"("A", "B");

-- CreateIndex
CREATE INDEX "_UsersToUsers_B_index" ON "_UsersToUsers"("B");

-- AddForeignKey
ALTER TABLE "_UsersToUsers" ADD FOREIGN KEY ("A") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UsersToUsers" ADD FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
