import { Montserrat } from "next/font/google";

/** Site-wide marketing face (homepage, NavBar, Footer). */
export const montserrat = Montserrat({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-home" });
