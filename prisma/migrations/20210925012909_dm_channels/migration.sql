-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('DM');

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "type" "ChannelType" NOT NULL,
    "fromId" TEXT,
    "toId" TEXT,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Channel_fromId_toId_key" ON "Channel"("fromId", "toId");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_toId_fromId_key" ON "Channel"("toId", "fromId");

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
