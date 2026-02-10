
import geoip from 'geoip-lite';
import { NextRequest } from 'next/server';

export interface MarketContext {
    region: 'UAE' | 'GLOBAL';
    country: string;
}

export class MarketRoutingMiddleware {
    /**
     * Detects the market context based on the request's IP address.
     * Prioritizes 'AE' (United Arab Emirates) as a sovereign region.
     */
    static getContext(req: NextRequest): MarketContext {
        // 1. Get IP from various headers or socket
        const forwarded = req.headers.get("x-forwarded-for");
        const ip = forwarded ? forwarded.split(',')[0] : "127.0.0.1";

        // 2. Mock for localhost development
        if (ip === "127.0.0.1" || ip === "::1") {
            // Check for a manual override header for testing
            const override = req.headers.get("x-market-override");
            if (override === "UAE") return { region: 'UAE', country: 'AE' };
            return { region: 'GLOBAL', country: 'US' };
        }

        // 3. GeoIP Lookup
        const geo = geoip.lookup(ip as string);
        const country = geo?.country || "US";

        // 4. Region Classification
        if (country === 'AE') {
            return { region: 'UAE', country: 'AE' };
        }

        return { region: 'GLOBAL', country: country };
    }
}
