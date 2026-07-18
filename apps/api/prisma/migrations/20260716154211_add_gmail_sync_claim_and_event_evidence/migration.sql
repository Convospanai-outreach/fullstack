ALTER TABLE "MailboxSyncCursor" ADD COLUMN "lockToken" TEXT;

CREATE UNIQUE INDEX "ConnectedMailbox_email_key" ON "ConnectedMailbox"("email");

ALTER TABLE "EmailEvent" ADD COLUMN "processedAt" TIMESTAMP(3);

ALTER TABLE "Email" ADD COLUMN "deliveryProvider" TEXT;

ALTER TABLE "Message" ADD COLUMN "emailEventId" TEXT;

CREATE UNIQUE INDEX "Message_emailEventId_key" ON "Message"("emailEventId");

ALTER TABLE "Message" ADD CONSTRAINT "Message_emailEventId_fkey" FOREIGN KEY ("emailEventId") REFERENCES "EmailEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
