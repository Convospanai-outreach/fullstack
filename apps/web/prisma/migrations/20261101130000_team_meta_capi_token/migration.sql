-- Team Meta Conversions API token: credentialVault EncryptedCredential JSON, encrypted at rest. Nullable, so existing teams are unaffected.
ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS "metaCapiTokenEnc" JSONB;
