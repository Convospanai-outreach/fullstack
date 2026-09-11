import { createClient } from "@supabase/supabase-js";

let storageClient: ReturnType<typeof createClient> | null = null;

function getSupabaseStorageClient() {
    if (storageClient) return storageClient;

    const url = process.env["SUPABASE_URL"];
    const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !serviceRoleKey) {
        throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set.");
    }

    storageClient = createClient(url, serviceRoleKey, {
        auth: { persistSession: false },
    });
    return storageClient;
}

export async function uploadPublicFile(bucket: string, path: string, file: File): Promise<{ url: string }> {
    const client = getSupabaseStorageClient();
    const { error } = await client.storage.from(bucket).upload(path, file, {
        contentType: file.type,
        upsert: true,
    });
    if (error) {
        throw new Error(`Supabase Storage upload failed: ${error.message}`);
    }

    const { data } = client.storage.from(bucket).getPublicUrl(path);
    return { url: data.publicUrl };
}
