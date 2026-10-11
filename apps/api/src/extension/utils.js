function cmfIsLinkedInProfileUrl(value) {
  try {
    const url = new URL(value);
    return url.hostname.endsWith("linkedin.com") && url.pathname.includes("/in/");
  } catch {
    return false;
  }
}

// The handle in a LinkedIn profile address ("jane-doe" in /in/jane-doe/), to tell whether two
// addresses are the same person.
function cmfLinkedInHandle(value) {
  try {
    const match = new URL(value).pathname.match(/\/in\/([^/]+)/);
    return match ? decodeURIComponent(match[1]).toLowerCase() : "";
  } catch {
    return "";
  }
}

// Trims trailing slashes off the configured API base (used by the V2 options page).
function cmfNormalizeApiBase(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}
