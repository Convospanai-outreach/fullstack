
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

        // 3. GeoIP Lookup (Dynamic safely to prevent Turbopack Windows crash)
        let country = "US";
        try {
            // We use require to prevent top-level module evaluation crash if data files are missing
            const geoip = require('geoip-lite');
            const geo = geoip.lookup(ip as string);
            if (geo?.country) {
                country = geo.country;
            }
        } catch (error) {
            console.warn("[MarketRouting] geoip-lite lookup failed, falling back to US:", error);
        }

        // 4. Region Classification
        if (country === 'AE') {
            return { region: 'UAE', country: 'AE' };
        }

        return { region: 'GLOBAL', country: country };
    }
}
