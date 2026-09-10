ALTER TABLE "User" ADD COLUMN "clerk_user_id" TEXT;

CREATE UNIQUE INDEX "User_clerk_user_id_key" ON "User"("clerk_user_id");
