function cmfIsLinkedInProfileUrl(value) {
  try {
    const url = new URL(value);
    return url.hostname.endsWith("linkedin.com") && url.pathname.includes("/in/");
  } catch {
    return false;
  }
}

// Trims trailing slashes off the configured API base (used by the V2 options page).
function cmfNormalizeApiBase(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}
