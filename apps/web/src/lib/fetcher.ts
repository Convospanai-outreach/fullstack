export async function fetcher(url: string, opts?: RequestInit) {
    const res = await fetch(url, opts);
    if (!res.ok) {
        const err = new Error("Fetch error");
        throw err;
    }
    return res.json();
}
