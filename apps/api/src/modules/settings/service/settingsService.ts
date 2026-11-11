import { prisma } from "@/lib/db";
import { decryptCredential, encryptCredential, type EncryptedCredential } from "@/lib/security/credentialVault";

// The encrypted Slack webhook never leaves the server; /settings/notifications/slack reports whether one is set.
const NOTIFICATIONS_READ = { omit: { slackWebhook: true } } as const;

// Stored AES-256-GCM encrypted (JSON-stringified into the plain String columns) and only ever sent to clients masked.
const SECRET_FIELDS = ["apiKeyOpenAI", "apiKeyGemini", "hubspotApiKey", "liCookie"] as const;
const MASK = "••••";

// Rows written before encryption hold the raw value; they read back as-is until the next save or the backfill script.
async function revealSecret(stored: string): Promise<string> {
    try {
        const payload = JSON.parse(stored) as EncryptedCredential;
        if (payload?.v === 1 && payload.cipher && payload.iv && payload.tag) {
            return (await decryptCredential(payload)) ?? "";
        }
    } catch {
        // not JSON: legacy plaintext
    }
    return stored;
}

function maskSecret(plain: string): string {
    return plain.length > 8 ? MASK + plain.slice(-4) : MASK;
}

class SettingsService {
    /**
     * Get settings for a user (or default if null)
     */
    async getSettings(userId: string) {
        let settings = await prisma.settings.findUnique({
            where: { userId },
            include: { notifications: NOTIFICATIONS_READ }
        });

        if (!settings) {
            // Auto-create default settings
            settings = await prisma.settings.create({
                data: {
                    userId,
                    notifications: {
                        create: {
                            userId // Required by schema
                        }
                    }
                },
                include: { notifications: NOTIFICATIONS_READ }
            });
        } else if (!settings.notifications) {
            // Heal: Create notifications if settings exist but relation is missing
            const notifs = await prisma.notificationSettings.create({
                data: {
                    settingsId: settings.id,
                    userId
                },
                ...NOTIFICATIONS_READ
            });
            settings.notifications = notifs;
        }

        return settings;
    }

    /**
     * Settings as the browser sees them: secrets masked, never plaintext or ciphertext.
     */
    async getSettingsForClient(userId: string) {
        const settings = await this.getSettings(userId);
        const out: Record<string, unknown> = { ...settings };
        for (const field of SECRET_FIELDS) {
            const stored = settings[field];
            out[field] = stored ? maskSecret(await revealSecret(stored)) : stored;
        }
        return out as typeof settings;
    }

    /**
     * Update top-level settings (API Keys, Theme, etc)
     */
    async updateSettings(userId: string, data: any) {
        // Explicit allowlist - `data` is untrusted request-body input, and Settings.userId
        // is a unique FK to User: passing it through unchecked would let a caller re-key
        // their own Settings row to another user's userId, hijacking that account's settings.
        const { name, email, theme, crmConfig } = data ?? {};
        const secrets: Partial<Record<(typeof SECRET_FIELDS)[number], string | null>> = {};
        for (const field of SECRET_FIELDS) {
            const value = data?.[field];
            if (typeof value !== "string" || value.startsWith(MASK)) continue; // omitted, or the masked value echoed back: keep what is stored
            secrets[field] = value === "" ? null : JSON.stringify(await encryptCredential(value));
        }
        return prisma.settings.update({
            where: { userId },
            data: { name, email, theme, crmConfig, ...secrets }
        });
    }

    /**
     * Update Notification preferences
     */
    async updateNotifications(userId: string, data: any) {
        const settings = await this.getSettings(userId);

        // Ensure notifications record exists (handled by getSettings, but just in case)
        if (!settings.notifications) {
            await prisma.notificationSettings.create({
                data: { settingsId: settings.id, userId }
            });
        }

        // Explicit allowlist - see updateSettings for why `data` must not be passed through raw.
        const { emailGlobal, emailCampaign, emailLeads, inAppGlobal, digestEnabled } = data ?? {};
        return prisma.notificationSettings.update({
            where: { settingsId: settings.id },
            data: { emailGlobal, emailCampaign, emailLeads, inAppGlobal, digestEnabled }
        });
    }
}

export const settingsService = new SettingsService();
