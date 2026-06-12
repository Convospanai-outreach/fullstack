export function isLinkedInProfilePage(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.hostname === "linkedin.com" || url.hostname.endsWith(".linkedin.com")) &&
      url.pathname.includes("/in/");
  } catch {
    return false;
  }
}
