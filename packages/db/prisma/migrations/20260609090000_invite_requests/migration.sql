CREATE TYPE "InviteRequestStatus" AS ENUM ('WAITLISTED', 'APPROVED', 'INVITED', 'ACTIVE', 'USED', 'REJECTED');

CREATE TABLE "invite_requests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "linkedin_url" TEXT NOT NULL,
    "use_case" TEXT NOT NULL,
    "status" "InviteRequestStatus" NOT NULL DEFAULT 'WAITLISTED',
    "invite_token" TEXT,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invite_requests_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "UserInvitation" ADD COLUMN "invite_request_id" TEXT;

CREATE UNIQUE INDEX "invite_requests_invite_token_key" ON "invite_requests"("invite_token");
CREATE INDEX "invite_requests_email_idx" ON "invite_requests"("email");
CREATE INDEX "invite_requests_status_idx" ON "invite_requests"("status");
CREATE INDEX "invite_requests_created_at_idx" ON "invite_requests"("created_at");
CREATE INDEX "invite_requests_approved_by_id_idx" ON "invite_requests"("approved_by_id");
CREATE INDEX "UserInvitation_invite_request_id_idx" ON "UserInvitation"("invite_request_id");

ALTER TABLE "invite_requests"
    ADD CONSTRAINT "invite_requests_approved_by_id_fkey"
    FOREIGN KEY ("approved_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserInvitation"
    ADD CONSTRAINT "UserInvitation_invite_request_id_fkey"
    FOREIGN KEY ("invite_request_id") REFERENCES "invite_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
