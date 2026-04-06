declare module "next/server" {
  export interface RequestCookie {
    name: string;
    value: string;
  }

  export interface RequestCookies {
    get(name: string): RequestCookie | undefined;
    getAll(name?: string): RequestCookie[];
    has(name: string): boolean;
    set(name: string, value: string): void;
    delete(name: string): void;
  }

  export interface NextURL extends URL {
    clone(): NextURL;
  }

  export interface NextRequest extends Request {
    cookies: RequestCookies;
    nextUrl: NextURL;
    geo?: unknown;
    ip?: string;
  }

  export class NextResponse<Body = unknown> extends Response {
    readonly cookies: RequestCookies;
    static json<T = unknown>(body: T, init?: ResponseInit): NextResponse<T>;
    static redirect(url: string | URL, init?: number | ResponseInit): NextResponse;
    static rewrite(url: string | URL, init?: ResponseInit): NextResponse;
    static next(init?: ResponseInit): NextResponse;
  }
}
