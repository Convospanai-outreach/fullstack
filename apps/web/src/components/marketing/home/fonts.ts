import { Cormorant_Garamond, Jost } from "next/font/google";

/** Marketing type, Italian-luxury direction: Jost for text, Cormorant Garamond for headlines. */
export const siteSans = Jost({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap", variable: "--font-home" });
export const siteSerif = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600"], display: "swap", variable: "--font-display" });
