-- AlterTable
ALTER TABLE "ICP" ADD COLUMN     "teamId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "ICP_teamId_idx" ON "ICP"("teamId");

-- AddForeignKey
ALTER TABLE "ICP" ADD CONSTRAINT "ICP_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
