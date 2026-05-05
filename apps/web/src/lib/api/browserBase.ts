export function getBrowserApiBase() {
    return "/api/proxy";
}

export function getBrowserApiUrl(path: string) {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${getBrowserApiBase()}${normalizedPath}`;
}
