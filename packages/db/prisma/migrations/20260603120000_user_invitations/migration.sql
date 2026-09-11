-- Extend enterprise roles for invite-only user management.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CMS_EDITOR';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'VIEWER';

CREATE TYPE "InvitationStatus" AS ENUM ('pending', 'accepted', 'expired', 'revoked');

CREATE TABLE "UserInvitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "teamId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserInvitation_tokenHash_key" ON "UserInvitation"("tokenHash");
CREATE INDEX "UserInvitation_email_idx" ON "UserInvitation"("email");
CREATE INDEX "UserInvitation_teamId_idx" ON "UserInvitation"("teamId");
CREATE INDEX "UserInvitation_invitedById_idx" ON "UserInvitation"("invitedById");
CREATE INDEX "UserInvitation_status_idx" ON "UserInvitation"("status");
CREATE INDEX "UserInvitation_expiresAt_idx" ON "UserInvitation"("expiresAt");

ALTER TABLE "UserInvitation"
    ADD CONSTRAINT "UserInvitation_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserInvitation"
    ADD CONSTRAINT "UserInvitation_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
