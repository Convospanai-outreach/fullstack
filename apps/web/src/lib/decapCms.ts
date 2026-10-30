// Settings for the Decap CMS admin at /cms. Editors sign in with GitHub; every save becomes a pull
// request on the site's repo (editorial workflow), so nothing goes live until it is reviewed and merged.

export const DECAP_SCRIPT = {
    src: "https://unpkg.com/decap-cms@3.17.3/dist/decap-cms.js",
    integrity: "sha384-RWRzuHfiZSWCt3nEvG7B0v3cMgM1C2UuJmgBSL92GQh4uXmNSkbcthql/mNBqvjr",
};

// The GitHub login is registered for one address, so the admin and its callback always use it.
export function canonicalOrigin(requestUrl: string): string {
    const configured = process.env["NEXTAUTH_URL"] || process.env["APP_URL"];
    try {
        return new URL(configured || requestUrl).origin;
    } catch {
        return new URL(requestUrl).origin;
    }
}

export function buildDecapConfig(origin: string): string {
    return `backend:
  name: github
  repo: Convospanai-outreach/fullstack
  branch: main
  base_url: ${origin}
  auth_endpoint: api/cms/auth

publish_mode: editorial_workflow
media_folder: apps/web/public/uploads
public_folder: /uploads

collections:
  - name: blog
    label: Blog posts
    folder: apps/web/content/blog
    extension: md
    format: frontmatter
    create: true
    slug: "{{slug}}"
    fields:
      - { label: Title, name: title, widget: string }
      - { label: Description, name: description, widget: text }
      - { label: Date, name: date, widget: datetime, format: "YYYY-MM-DDTHH:mm:ss.SSS[Z]" }
      - { label: Body, name: body, widget: markdown }
  - name: faq
    label: FAQ
    files:
      - label: FAQ page
        name: faq
        file: apps/web/content/faq/general.md
        fields:
          - { label: Title, name: title, widget: string }
          - { label: Description, name: description, widget: text }
          - { label: Body, name: body, widget: markdown }
`;
}
