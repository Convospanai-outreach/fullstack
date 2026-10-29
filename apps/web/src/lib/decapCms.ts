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
      - { label: Category, name: category, widget: string, required: false }
      - { label: Body, name: body, widget: markdown }
  - name: testimonials
    label: Testimonials
    folder: apps/web/content/testimonials
    extension: md
    format: frontmatter
    create: true
    slug: "{{slug}}"
    fields:
      - { label: Name, name: name, widget: string }
      - { label: Role, name: role, widget: string, required: false }
      - { label: Company, name: company, widget: string, required: false }
      - { label: Order, name: order, widget: number, value_type: int, default: 0 }
      - { label: Quote, name: body, widget: text }
  - name: locations
    label: Locations
    folder: apps/web/content/locations
    extension: json
    format: json
    create: true
    slug: "{{slug}}"
    identifier_field: name
    fields:
      - { label: Order, name: order, widget: number, value_type: int }
      - { label: URL slug, name: slug, widget: string, hint: "Used in /locations/<slug>. Must match the file name." }
      - { label: City, name: name, widget: string }
      - { label: State, name: state, widget: string }
      - { label: State code, name: stateCode, widget: string, hint: "For example IN-HR" }
      - { label: Place name, name: placename, widget: string }
      - { label: Position, name: position, widget: string }
      - { label: ICBM, name: icbm, widget: string }
      - { label: Latitude, name: latitude, widget: string }
      - { label: Longitude, name: longitude, widget: string }
      - { label: Corridors, name: corridors, widget: list, field: { label: Corridor, name: corridor, widget: string } }
      - { label: Industry focus, name: industryFocus, widget: list, field: { label: Industry, name: industry, widget: string } }
      - { label: Summary, name: summary, widget: text }
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
