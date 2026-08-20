export function usePathname(): string {
  return "/";
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams();
}

export function useRouter() {
  return {
    push: (_href?: string, _options?: unknown) => {},
    replace: (_href?: string, _options?: unknown) => {},
    back: () => {},
    forward: () => {},
    refresh: () => {},
    prefetch: (_href?: string) => {},
  };
}
