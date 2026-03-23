
const API_URL = process.env['NEXT_PUBLIC_API_URL'] || '';
const ENCRYPTION_KEY = process.env["ENCRYPTION_KEY"] || "";
const isServer = typeof window === "undefined";

export interface StoredSmtpConfig {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    fromName: string;
    fromEmail: string;
}

type EncryptedSecret = {
    v: number;
    cipher: string;
    iv: string;
    tag: string;
};

type StoredSmtpRecord = StoredSmtpConfig & {
    password?: EncryptedSecret | string;
};

function getKey(): Buffer {
    if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
        throw new Error("ENCRYPTION_KEY must be set to a 32-byte hex string");
    }
    return Buffer.from(ENCRYPTION_KEY, "hex");
}

async function encryptSecret(value: string): Promise<EncryptedSecret> {
    const crypto = await import("crypto");
    const key = getKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        v: 1,
        cipher: encrypted.toString("base64"),
        iv: iv.toString("base64"),
        tag: tag.toString("base64"),
    };
}

async function decryptSecret(secret?: EncryptedSecret | string): Promise<string | undefined> {
    if (!secret) return undefined;
    if (typeof secret === "string") return secret;
    if (secret.v !== 1) return undefined;
    const crypto = await import("crypto");
    const key = getKey();
    const iv = Buffer.from(secret.iv, "base64");
    const tag = Buffer.from(secret.tag, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(secret.cipher, "base64")),
        decipher.final()
    ]);
    return decrypted.toString("utf8");
}

async function getTeamConfig(teamId: string): Promise<StoredSmtpRecord | null> {
    const { prisma } = await import("@/lib/db");
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { aiConfig: true }
    });
    const cfg = (team?.aiConfig as any)?.smtpConfig;
    if (!cfg) return null;
    return cfg as StoredSmtpRecord;
}

async function setTeamConfig(teamId: string, config: StoredSmtpRecord | null): Promise<void> {
    const { prisma } = await import("@/lib/db");
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { aiConfig: true }
    });
    const aiConfig = (team?.aiConfig as any) || {};
    if (config) {
        aiConfig.smtpConfig = config;
    } else {
        delete aiConfig.smtpConfig;
    }
    await prisma.team.update({
        where: { id: teamId },
        data: { aiConfig }
    });
}

export async function getSmtpConfig(teamId: string): Promise<any | null> {
    if (!teamId) return null;
    if (isServer) {
        const record = await getTeamConfig(teamId);
        if (!record) return null;
        return {
            host: record.host,
            port: record.port,
            secure: record.secure,
            user: record.user,
            password: await decryptSecret(record.password),
            fromName: record.fromName,
            fromEmail: record.fromEmail
        };
    }
    try {
        const res = await fetch(`${API_URL}/smtp/config?teamId=${teamId}`);
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

export async function saveSmtpConfig(teamId: string, config: any): Promise<void> {
    if (!teamId) return;
    if (isServer) {
        const record: StoredSmtpRecord = {
            host: config.host,
            port: config.port,
            secure: config.secure,
            user: config.user,
            fromName: config.fromName,
            fromEmail: config.fromEmail,
            ...(config.password ? { password: await encryptSecret(config.password) } : {})
        };
        await setTeamConfig(teamId, record);
        return;
    }
    await fetch(`${API_URL}/smtp/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, config })
    });
}

export async function deleteSmtpConfig(teamId: string): Promise<void> {
    if (!teamId) return;
    if (isServer) {
        await setTeamConfig(teamId, null);
        return;
    }
    await fetch(`${API_URL}/smtp/config`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId })
    });
}

export async function getSmtpConfigRedacted(teamId: string): Promise<StoredSmtpConfig | null> {
    if (!teamId) return null;
    if (isServer) {
        const record = await getTeamConfig(teamId);
        if (!record) return null;
        return {
            host: record.host,
            port: record.port,
            secure: record.secure,
            user: record.user,
            fromName: record.fromName,
            fromEmail: record.fromEmail
        };
    }
    try {
        const res = await fetch(`${API_URL}/smtp/config/redacted?teamId=${teamId}`);
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}
