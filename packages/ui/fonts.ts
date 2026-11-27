import { Montserrat } from "next/font/google";

/** One typeface for the product and public site. */
export const siteSans = Montserrat({ subsets: ["latin"], display: "swap", variable: "--font-home" });
export const siteSerif = Montserrat({ subsets: ["latin"], display: "swap", variable: "--font-display" });
