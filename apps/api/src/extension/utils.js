function cmfNormalizeApiBase(value) {
  return (value || "http://localhost:3000/api").replace(/\/+$/, "");
}

function cmfIsLinkedInProfileUrl(value) {
  try {
    const url = new URL(value);
    return url.hostname.endsWith("linkedin.com") && url.pathname.includes("/in/");
  } catch {
    return false;
  }
}
