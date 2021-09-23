-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "hashedToken" TEXT NOT NULL,
    "protectedKeychain" JSONB NOT NULL,
    "avatar" TEXT NOT NULL DEFAULT E'https://cdn.nekos.life/avatar/avatar_13.png',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
