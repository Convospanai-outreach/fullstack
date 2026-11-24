import { Montserrat } from "next/font/google";

/** One typeface for the whole product: Montserrat (variable font, all weights). Both CSS variables resolve to the same file. */
export const siteSans = Montserrat({ subsets: ["latin"], display: "swap", variable: "--font-home" });
export const siteSerif = Montserrat({ subsets: ["latin"], display: "swap", variable: "--font-display" });
