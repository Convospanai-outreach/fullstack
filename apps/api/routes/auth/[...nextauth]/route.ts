import NextAuthImport from "next-auth";
import { authOptions } from "@/lib/auth";

const NextAuth = (NextAuthImport as any).default ?? NextAuthImport;
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
