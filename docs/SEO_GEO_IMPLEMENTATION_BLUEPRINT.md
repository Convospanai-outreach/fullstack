# B2B Technical SEO & Local Geo-Targeting Implementation Blueprint
### *The Definitive Playbook, Guiding Principles & Verification Checklist for High-Performance Enterprise Web Platforms*

---

## 1. Executive Summary & Core Philosophy

This blueprint provides an end-to-end framework for engineering search authority, geographic relevance, and conversion resilience into modern web applications.

### Guiding Principles:
1. **Institutional Trust Over Generic Marketing**: B2B search engines, AI answer engines (Perplexity, ChatGPT, Claude), and human procurement committees prioritize verified credentials (MCA registration, CIN, director DINs, ISO standards) over vanity claims.
2. **Dual-Layer Consistency (HTML + JSON-LD)**: Every semantic and geographic signal declared in `<meta>` tags must match structured data (`application/ld+json`) with 100% precision.
3. **Sub-Second Performance & Bandwidth Discipline**: Heavy uncompressed assets destroy mobile Core Web Vitals and bounce high-intent buyers. All imagery must be WebP/AVIF with 1-year immutable caching.
4. **Ad-Blocker & Privacy Shield Resilience**: Client-side analytics (`gtag.js`) is routinely blocked by enterprise firewalls and Brave/uBlock shields. Mission-critical lead conversions must support server-side attribution via the GA4 Measurement Protocol.

---

## 2. Global Layout & Document Head Architecture

Every page must inherit a centralized layout (`Layout.astro` / `Layout.tsx`) enforcing the following `<head>` tags:

### 2.1 Standard SEO Tags
```html
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{title}</title>
<meta name="description" content={description} />
<link rel="canonical" href={canonical} />
<meta name="author" content="Corporate Entity Legal Name" />
<meta name="publisher" content="Brand Name" />
<meta name="theme-color" content="#0284c7" />
```

* **Title Tag Rule**: Under 60 characters for SERP display. Format: `[Primary Keyword/Service] | [Brand Name]` or `[Local Service in City] | [Brand Name]`.
* **Meta Description Rule**: 130–155 characters. Must include a clear value proposition, geographical or vertical focus, and a direct action verb. Avoid breaking on apostrophes in code generation.

### 2.2 Open Graph & Social Cards (1200×630px)
Never use a placeholder or missing URL for `og:image`. A 404 social image breaks link previews on LinkedIn, WhatsApp, Slack, and X:
```html
<meta property="og:type" content="website" />
<meta property="og:url" content={canonical} />
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:image" content="https://yourdomain.com/images/og-branded.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:locale" content="en_IN" />
<meta property="og:site_name" content="Brand Name" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content={title} />
<meta name="twitter:description" content={description} />
<meta name="twitter:image" content="https://yourdomain.com/images/og-branded.png" />
```

### 2.3 Favicons & PWA Web Manifest
Provide all 5 standard asset variants:
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
<link rel="shortcut icon" href="/favicon.ico" />
<link rel="manifest" href="/manifest.webmanifest" />
```

---

## 3. Multi-Region Geo-Targeting Playbook (10-City Engine)

When building location landing pages (`/locations/[city]`), the layout must dynamically accept and emit exact geographic coordinates and state codes.

### 3.1 Dynamic Layout Props
In `Layout.astro`:
```typescript
interface Props {
  title: string;
  description: string;
  canonical?: string;
  geoRegion?: string;       // Default: 'IN-HR'
  geoPlacename?: string;    // Default: 'Gurugram, Delhi NCR, India'
  geoPosition?: string;     // Default: '28.4595;77.0266'
  geoICBM?: string;         // Default: '28.4595, 77.0266'
}
```

In `<head>`:
```html
<!-- Geo & Regional Meta Tags -->
<meta name="geo.region" content={geoRegion} />
<meta name="geo.placename" content={geoPlacename} />
<meta name="geo.position" content={geoPosition} />
<meta name="ICBM" content={geoICBM} />
```

### 3.2 Master Geographic Matrix (Reference Values for India)

| Location Slug | State Code (`geo.region`) | City Placename (`geo.placename`) | Coordinates (`geo.position`) | ICBM (`geo.ICBM`) |
|---|---|---|---|---|
| `/locations/gurugram` | `IN-HR` | Gurugram, Haryana, India | `28.4595;77.0266` | `28.4595, 77.0266` |
| `/locations/delhi` | `IN-DL` | New Delhi, Delhi, India | `28.6139;77.2090` | `28.6139, 77.2090` |
| `/locations/noida` | `IN-UP` | Noida, Uttar Pradesh, India | `28.5355;77.3910` | `28.5355, 77.3910` |
| `/locations/mumbai` | `IN-MH` | Mumbai, Maharashtra, India | `19.0760;72.8777` | `19.0760, 72.8777` |
| `/locations/bengaluru` | `IN-KA` | Bengaluru, Karnataka, India | `12.9716;77.5946` | `12.9716, 77.5946` |
| `/locations/hyderabad` | `IN-TG` | Hyderabad, Telangana, India | `17.3850;78.4867` | `17.3850, 78.4867` |
| `/locations/pune` | `IN-MH` | Pune, Maharashtra, India | `18.5204;73.8567` | `18.5204, 73.8567` |
| `/locations/chennai` | `IN-TN` | Chennai, Tamil Nadu, India | `13.0827;80.2707` | `13.0827, 80.2707` |
| `/locations/kolkata` | `IN-WB` | Kolkata, West Bengal, India | `22.5726;88.3639` | `22.5726, 88.3639` |
| `/locations/ahmedabad` | `IN-GJ` | Ahmedabad, Gujarat, India | `23.0225;72.5714` | `23.0225, 72.5714` |

### 3.3 Matching LocalBusiness Schema
Every location page must include a JSON-LD script matching the exact coordinates:
```html
<script type="application/ld+json" is:inline set:html={JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["MarketingAgency", "LocalBusiness"],
      "@id": "https://yourdomain.com/locations/chennai#localbusiness",
      "name": "StepUp DigiWorld - Digital Marketing Agency Chennai",
      "url": "https://yourdomain.com/locations/chennai",
      "telephone": "+919711970445",
      "priceRange": "₹₹₹",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Chennai",
        "addressRegion": "Tamil Nadu",
        "addressCountry": "IN"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": "13.0827",
        "longitude": "80.2707"
      },
      "areaServed": [
        { "@type": "City", "name": "Chennai" },
        { "@type": "AdministrativeArea", "name": "OMR IT Expressway" },
        { "@type": "AdministrativeArea", "name": "Guindy" },
        { "@type": "AdministrativeArea", "name": "Sriperumbudur" }
      ]
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://yourdomain.com/locations/chennai#breadcrumb",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://yourdomain.com" },
        { "@type": "ListItem", "position": 2, "name": "Locations", "item": "https://yourdomain.com/locations" },
        { "@type": "ListItem", "position": 3, "name": "Chennai", "item": "https://yourdomain.com/locations/chennai" }
      ]
    }
  ]
})} />
```

---

## 4. Structured Data Hierarchy (Schema.org & LLMs)

### 4.1 Schema Stack by Page Type

| Page Type | Required Schemas |
|---|---|
| **Global / Homepage** | `Organization`, `LocalBusiness`, `WebSite` (with `inLanguage` & publisher link) |
| **Location Pages** | `LocalBusiness` (city geo), `BreadcrumbList`, `FAQPage` |
| **Service Pages** | `Service` (with `serviceType`, `provider`, `areaServed`), `BreadcrumbList`, `FAQPage` |
| **Industry Pages** | `Service` / `ProfessionalService`, `BreadcrumbList`, `FAQPage` |
| **Blog Posts** | `BlogPosting` (with `headline`, `author`, `datePublished`, `publisher`), `BreadcrumbList` |
| **About Page** | `AboutPage`, `Organization` (with statutory taxID/CIN, directors, foundingDate), `BreadcrumbList` |
| **Case Studies** | `ItemList` (with client deliverables & metrics), `BreadcrumbList` |

### 4.2 LLM & AI Engine Discovery Standards (`llms.txt`)
AI crawlers (SearchGPT, Claude, Perplexity) crawl dedicated context files at the site root:
* **`/llms.txt`**: Markdown executive summary of products, services, leadership credentials, and location corridors.
* **`/llms-full.txt`**: Detailed knowledge base covering all service blueprints, pricing guidelines, case study outcomes, and FAQ repositories.
* Link them in `<head>`:
  ```html
  <link rel="alternate" type="text/markdown" title="LLMs Text Summary" href="/llms.txt" />
  <link rel="alternate" type="text/markdown" title="LLMs Full Knowledge Base" href="/llms-full.txt" />
  ```

---

## 5. Technical Infrastructure, Crawling & Server Security

### 5.1 Robots.txt Best Practice
Place in `public/robots.txt`:
```txt
User-agent: *
Allow: /
Sitemap: https://yourdomain.com/sitemap.xml

# LLM & AI Crawler Permissions
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: OIMG-Bot
Allow: /
```

### 5.2 Dynamic XML Sitemap with Clean Exclusion
Build sitemaps programmatically (`sitemap.xml.ts`):
* **Include**: Active canonical routes, service pages, location hubs, and markdown blog articles.
* **Include**: `<lastmod>`, `<changefreq>`, and `<priority>`.
* **Exclude**: 301 redirect stubs, thank-you confirmation screens, and 404 pages.

### 5.3 Custom 404 Error Handling
* Build a branded `src/pages/404.astro` featuring:
  - Clear "Resource Not Found" status
  - Primary button to return Home
  - Secondary button to book consultation
  - Quick-link cards to core services and regional hubs
* Direct the web server in `.htaccess`:
  ```apache
  ErrorDocument 404 /404.html
  ```

### 5.4 Hardened `.htaccess` Security & Performance Rules
```apache
# 1. Prevent Directory Browsing & Server Signatures
Options -Indexes -ExecCGI
ServerSignature Off

# 2. Block Access to Hidden & Sensitive System Files
<FilesMatch "^\.(?!well-known)">
    Order allow,deny
    Deny from all
</FilesMatch>

# 3. Security Headers
<IfModule mod_headers.c>
    Header set X-Frame-Options "SAMEORIGIN"
    Header set X-Content-Type-Options "nosniff"
    Header set X-XSS-Protection "1; mode=block"
    Header set Referrer-Policy "strict-origin-when-cross-origin"
    Header set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()"
    Header set Content-Security-Policy "default-src 'self' https: data: 'unsafe-inline' 'unsafe-eval'; img-src 'self' https: data: blob:; font-src 'self' https: data:; connect-src 'self' https:; frame-ancestors 'self';"
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
</IfModule>

# 4. Gzip / Deflate Compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css application/javascript application/json image/svg+xml
</IfModule>

# 5. 1-Year Immutable Browser Caching for Static Assets
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType image/svg+xml "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/webp "access plus 1 year"
    ExpiresByType font/woff2 "access plus 1 year"
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType application/manifest+json "access plus 1 week"
    ExpiresByType text/html "access plus 0 seconds"
</IfModule>

# 6. Force HTTPS
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{HTTPS} off
    RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</IfModule>
```

---

## 6. Media Optimization Playbook (WebP Compression)

Never deploy uncompressed stock photos or AI-generated JPEGs directly to production.

### 6.1 Batch Conversion Workflow
Using Sharp in Node.js:
```javascript
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const imgDir = 'public/images';
const files = fs.readdirSync(imgDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));

for (const f of files) {
  const input = path.join(imgDir, f);
  const output = path.join(imgDir, f.replace(/\.(jpe?g|png)$/, '.webp'));
  await sharp(input)
    .webp({ quality: 82, effort: 5 })
    .toFile(output);
}
```

### 6.2 Benchmark Results
* High-res JPEGs (800KB–1,050KB) compress to high-quality WebP at **80KB–155KB** (**79% to 87% payload reduction**).
* Result: Faster First Contentful Paint (FCP) and Largest Contentful Paint (LCP), yielding 95+ mobile PageSpeed scores.

---

## 7. Conversion Tracking & Server-Side GA4 Measurement Protocol

### 7.1 Client-Side Form Tracking (`LeadCaptureForm.astro`)
Always emit Google's standard recommended event alongside any custom tags:
```javascript
// Capture GA4 client_id from _ga cookie
const gaCookie = document.cookie.split('; ').find(row => row.startsWith('_ga='));
if (gaCookie) {
  const parts = gaCookie.split('.');
  if (parts.length >= 4) {
    data.ga_client_id = `${parts[2]}.${parts[3]}`;
  }
}

// Fire standard GA4 Lead Conversion Event
if (typeof window.gtag === 'function') {
  window.gtag('event', 'generate_lead', {
    currency: 'INR',
    value: 5000,
    event_category: 'Lead Capture',
    event_label: data.serviceNeeded,
    form_source: data.form_source
  });
}
```

### 7.2 Server-Side Fallback via Measurement Protocol (`lead-receiver.php`)
When a lead is submitted to the backend, dispatch an HTTP POST directly to Google Analytics to capture conversions even if the client blocks browser scripts:
```php
$gaMeasurementId = 'G-XXXXXXXXXX';
$gaApiSecret = 'YOUR_API_SECRET'; // From GA4 Admin > Data Streams > Measurement Protocol API secrets

if (!empty($gaApiSecret)) {
    $clientId = !empty($data['ga_client_id']) 
        ? $data['ga_client_id'] 
        : hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . ($_SERVER['HTTP_USER_AGENT'] ?? ''));

    $mpPayload = [
        'client_id' => $clientId,
        'events' => [
            [
                'name' => 'generate_lead',
                'params' => [
                    'currency' => 'INR',
                    'value' => 5000,
                    'service' => $entry['serviceNeeded'] ?? '',
                    'form_source' => $entry['form_source'] ?? '',
                    'utm_source' => $entry['utm_source'] ?? 'direct',
                    'utm_medium' => $entry['utm_medium'] ?? 'none',
                    'utm_campaign' => $entry['utm_campaign'] ?? '',
                    'engagement_time_msec' => 1000
                ]
            ]
        ]
    ];

    $ch = curl_init("https://www.google-analytics.com/mp/collect?measurement_id={$gaMeasurementId}&api_secret={$gaApiSecret}");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($mpPayload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    curl_exec($ch);
    curl_close($ch);
}
```

---

## 8. Master Implementation & Audit Checklist (To-Do List)

Use this checklist for every new web deployment:

### Phase 1: Core Foundation & Metadata
- [ ] Central layout defines `title`, `description`, `canonical`, and `keywords`.
- [ ] All title tags are concise (under 60 characters for SERP display).
- [ ] All meta descriptions are between 130 and 155 characters with no quote parsing bugs.
- [ ] Canonical URLs use strict HTTPS and absolute domain paths.
- [ ] Open Graph image (1200×630px PNG) exists at `/images/og-branded.png` and returns HTTP 200.
- [ ] Open Graph and Twitter card tags are fully declared on every page.
- [ ] Favicon suite deployed (SVG, ICO, 16x16, 32x32, 180x180 apple-touch-icon).
- [ ] Web App Manifest deployed (`manifest.webmanifest` and `manifest.json`).

### Phase 2: Multi-City Local SEO
- [ ] Layout accepts optional `geoRegion`, `geoPlacename`, `geoPosition`, and `geoICBM`.
- [ ] Each regional landing page passes accurate state code (e.g., `IN-TN`, `IN-MH`, `IN-KA`).
- [ ] Each regional landing page includes matching JSON-LD `LocalBusiness` schema with exact coordinates.
- [ ] HTML grid containers are balanced and closed properly to prevent micro-market column squishing.

### Phase 3: Semantic Structured Data
- [ ] `BreadcrumbList` schema deployed on all Service, Industry, Blog, and Corporate pages.
- [ ] `Organization` schema includes statutory corporate registration (CIN, ROC, Tax ID, Directors).
- [ ] `Service` schema deployed on all service landing pages with `serviceType` and `areaServed`.
- [ ] `BlogPosting` schema deployed on all blog articles with `headline`, `author`, `datePublished`.
- [ ] `FAQPage` schema deployed on all accordion FAQ sections.
- [ ] `llms.txt` and `llms-full.txt` published at domain root for AI search engines.

### Phase 4: Performance & Server Hardening
- [ ] All content imagery converted to modern WebP format (aiming for >80% size reduction).
- [ ] Image dimensions (`width` and `height`) and `loading="lazy"` set on below-the-fold media.
- [ ] Branded `404.astro` created and linked via `ErrorDocument 404 /404.html`.
- [ ] `.htaccess` configured with HSTS (`max-age=31536000; includeSubDomains; preload`).
- [ ] `.htaccess` configured with 1-year immutable caching for static assets (`image/*`, `css`, `js`).
- [ ] `.htaccess` configured with Gzip/Deflate compression.
- [ ] Anti-bot honeypots, minimum submission speed traps, and rate limiting active on forms.

### Phase 5: Tracking & Google Ecosystem Integration
- [ ] GA4 tracking snippet (`gtag.js`) deployed in `<head>` on all pages.
- [ ] Google Search Console verified via GA4 tag or DNS TXT.
- [ ] XML Sitemap (`sitemap.xml`) submitted to Google Search Console.
- [ ] `generate_lead` standard event triggered upon form submission with currency and estimated deal value.
- [ ] Visitor Google Analytics `client_id` extracted from `_ga` cookie.
- [ ] Server-side GA4 Measurement Protocol dispatch ready in lead processing endpoint.
