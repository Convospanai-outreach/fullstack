-- AlterTable: Job.heartbeatAt lets a long-running handler prove it is still
-- alive so resetStaleJobs stops falsely reclaiming it after 15 minutes.
ALTER TABLE "Job" ADD COLUMN "heartbeatAt" TIMESTAMP(3);

-- AlterTable: Email.idempotencyKey guards against a retried send job calling
-- the provider a second time after a real send already succeeded.
ALTER TABLE "Email" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "Email_idempotencyKey_key" ON "Email"("idempotencyKey");
