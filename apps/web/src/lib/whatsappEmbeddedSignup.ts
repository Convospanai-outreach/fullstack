// Meta's WhatsApp Embedded Signup: the customer connects their own WhatsApp Business Account in a
// Meta popup. The popup returns a one-time code (through FB.login) and, in a separate window message,
// the ids of the account and number they picked. Both are sent to our API, which turns the code into the
// customer's own access token. Needs a Meta app that is an approved Tech Provider; see the API's
// embeddedSignup module.

const GRAPH_VERSION = "v26.0";
const FACEBOOK_ORIGINS = new Set(["https://www.facebook.com", "https://web.facebook.com"]);

export type SignupMessage =
    | { kind: "finish"; phoneNumberId: string; wabaId: string }
    | { kind: "cancel" };

/** Reads one window message: the finished signup, a cancel, or null for anything unrelated. */
export function parseSignupMessage(origin: string, data: unknown): SignupMessage | null {
    if (!FACEBOOK_ORIGINS.has(origin)) return null;
    let payload: any = data;
    if (typeof payload === "string") {
        try {
            payload = JSON.parse(payload);
        } catch {
            return null;
        }
    }
    if (!payload || payload.type !== "WA_EMBEDDED_SIGNUP") return null;

    const event = typeof payload.event === "string" ? payload.event : "";
    if (event === "CANCEL") return { kind: "cancel" };
    if (event.startsWith("FINISH")) {
        const phoneNumberId = payload.data?.phone_number_id;
        const wabaId = payload.data?.waba_id;
        if (typeof phoneNumberId === "string" && typeof wabaId === "string" && phoneNumberId && wabaId) {
            return { kind: "finish", phoneNumberId, wabaId };
        }
    }
    return null;
}

export type EmbeddedSignupResult = { code: string; phoneNumberId: string; wabaId: string };

function loadFacebookSdk(appId: string): Promise<any> {
    const w = window as any;
    if (w.FB) return Promise.resolve(w.FB);
    return new Promise((resolve, reject) => {
        w.fbAsyncInit = () => {
            w.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version: GRAPH_VERSION });
            resolve(w.FB);
        };
        const script = document.createElement("script");
        script.src = "https://connect.facebook.net/en_US/sdk.js";
        script.async = true;
        script.defer = true;
        script.crossOrigin = "anonymous";
        script.onerror = () => reject(new Error("Could not load WhatsApp signup. Check your connection or ad blocker."));
        document.body.appendChild(script);
    });
}

/** Opens Meta's signup popup and resolves with the code plus the account and number the customer chose. */
export async function startEmbeddedSignup(config: { appId: string; configId: string }): Promise<EmbeddedSignupResult> {
    const FB = await loadFacebookSdk(config.appId);

    return new Promise((resolve, reject) => {
        let code: string | null = null;
        let ids: { phoneNumberId: string; wabaId: string } | null = null;

        const finish = () => {
            if (code && ids) {
                window.removeEventListener("message", onMessage);
                resolve({ code, ...ids });
            }
        };
        const fail = (message: string) => {
            window.removeEventListener("message", onMessage);
            reject(new Error(message));
        };
        const onMessage = (event: MessageEvent) => {
            const parsed = parseSignupMessage(event.origin, event.data);
            if (!parsed) return;
            if (parsed.kind === "cancel") return fail("WhatsApp signup was cancelled.");
            ids = { phoneNumberId: parsed.phoneNumberId, wabaId: parsed.wabaId };
            finish();
        };
        window.addEventListener("message", onMessage);

        FB.login(
            (response: any) => {
                const received = response?.authResponse?.code;
                if (typeof received !== "string" || !received) return fail("WhatsApp signup was cancelled.");
                code = received;
                finish();
            },
            {
                config_id: config.configId,
                response_type: "code",
                override_default_response_type: true,
                extras: { setup: {}, sessionInfoVersion: "3" },
            },
        );
    });
}
