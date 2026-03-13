
const API_URL = process.env['NEXT_PUBLIC_API_URL'] || '';

export interface StoredSmtpConfig {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    fromName: string;
    fromEmail: string;
}

export async function getSmtpConfig(teamId: string): Promise<any | null> {
    try {
        const res = await fetch(`${API_URL}/smtp/config?teamId=${teamId}`);
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

export async function saveSmtpConfig(teamId: string, config: any): Promise<void> {
    await fetch(`${API_URL}/smtp/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, config })
    });
}

export async function deleteSmtpConfig(teamId: string): Promise<void> {
    await fetch(`${API_URL}/smtp/config`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId })
    });
}

export async function getSmtpConfigRedacted(teamId: string): Promise<StoredSmtpConfig | null> {
    try {
        const res = await fetch(`${API_URL}/smtp/config/redacted?teamId=${teamId}`);
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}
