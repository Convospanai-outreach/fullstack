import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

// scrypt cost params. N must be a power of 2; kept as a module constant (not
// stored per-hash) since the stored string already namespaces it as "v1".
// scryptSync (not promisify(scrypt)) - @types/node's promisify overload for
// scrypt drops the options parameter, so the 4-arg call doesn't type-check.
const N = 16384;
const r = 8;
const p = 1;
const KEY_LENGTH = 64;

export async function hashSuperAdminPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derivedKey = scryptSync(password, salt, KEY_LENGTH, { N, r, p });
    return `scrypt$v1$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

export async function verifySuperAdminPassword(password: string, stored: string): Promise<boolean> {
    const parts = stored.split("$");
    if (parts.length !== 4 || parts[0] !== "scrypt" || parts[1] !== "v1") return false;
    const [, , saltHex, hashHex] = parts;
    if (!saltHex || !hashHex) return false;

    try {
        const salt = Buffer.from(saltHex, "hex");
        const expected = Buffer.from(hashHex, "hex");
        const derivedKey = scryptSync(password, salt, expected.length, { N, r, p });
        return timingSafeEqual(derivedKey, expected);
    } catch {
        return false;
    }
}
