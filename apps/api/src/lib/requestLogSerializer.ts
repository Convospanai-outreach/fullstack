// Fastify's default request log line includes the full URL. Query strings carry things like unsubscribe and
// verification tokens and OAuth codes, which must not end up in log storage, so log the path only.
export function serializeRequestForLog(request: {
    method?: string;
    url?: string;
    host?: string;
    ip?: string;
    socket?: { remotePort?: number };
}) {
    return {
        method: request.method,
        url: request.url?.split("?")[0],
        host: request.host,
        remoteAddress: request.ip,
        remotePort: request.socket?.remotePort,
    };
}
