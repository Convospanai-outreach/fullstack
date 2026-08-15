import puppeteer, { type Browser } from "puppeteer";

// Dedicated, lazily-launched singleton - kept separate from the scraper-bridge
// browserManager (stealth-plugin, scraping-purpose) so invoice rendering never
// competes with or is disrupted by scrape-worker browser lifecycle, while still
// avoiding a fresh Chromium launch per download.
let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
    if (!browserPromise) {
        browserPromise = puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });
    }
    return browserPromise;
}

const SELLER = {
    name: "Sudhisha Digital Private Limited",
    addressLines: [
        "8th Floor, No. 486, Plot 11 Air Force and Naval Officers Enclave",
        "Sector 7, Sector 6 Dwarka, New Delhi",
        "South West Delhi, Delhi - 110075, India"
    ],
    gstin: "07ABOCS1373C1ZC",
    pan: "ABOCS1373C",
    cin: "U74103DL2024PTC435624"
};

export type InvoicePdfData = {
    invoiceNumber: string;
    createdAt: Date;
    description: string;
    amount: number;
    currency: string;
    taxableValue: number | null;
    taxAmount: number | null;
    taxType: string | null;
    taxRate: number | null;
    paymentId: string;
    orderId: string | null;
    status: string;
    billingCountry: string | null;
    billingState: string | null;
    team: { name: string };
    user: { name: string | null; email: string };
};

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function formatMoney(amountInSmallestUnit: number, currency: string): string {
    const major = amountInSmallestUnit / 100;
    return `${currency} ${major.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function renderTaxSection(inv: InvoicePdfData): string {
    if (!inv.taxType || inv.taxType === "NONE" || inv.taxableValue === null) {
        return `
            <tr><td class="label">Taxable Value</td><td class="value">${formatMoney(inv.amount, inv.currency)}</td></tr>
            <tr><td class="label">GST</td><td class="value">Not applicable &mdash; export of services / non-India customer</td></tr>
        `;
    }

    const taxAmount = inv.taxAmount ?? 0;
    if (inv.taxType === "CGST_SGST") {
        const half = Math.round(taxAmount / 2);
        return `
            <tr><td class="label">Taxable Value</td><td class="value">${formatMoney(inv.taxableValue, inv.currency)}</td></tr>
            <tr><td class="label">CGST @ ${(inv.taxRate ?? 0) / 2}%</td><td class="value">${formatMoney(half, inv.currency)}</td></tr>
            <tr><td class="label">SGST @ ${(inv.taxRate ?? 0) / 2}%</td><td class="value">${formatMoney(taxAmount - half, inv.currency)}</td></tr>
        `;
    }

    return `
        <tr><td class="label">Taxable Value</td><td class="value">${formatMoney(inv.taxableValue, inv.currency)}</td></tr>
        <tr><td class="label">IGST @ ${inv.taxRate ?? 0}%</td><td class="value">${formatMoney(taxAmount, inv.currency)}</td></tr>
    `;
}

function renderInvoiceHtml(inv: InvoicePdfData): string {
    const issueDate = inv.createdAt.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
    const billingAddress = inv.billingCountry
        ? [inv.billingState, inv.billingCountry].filter(Boolean).join(", ")
        : "Not on file";

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #1a1a1a; padding: 48px; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a1a1a; padding-bottom: 20px; margin-bottom: 24px; }
  .seller-name { font-size: 20px; font-weight: 700; margin-bottom: 6px; }
  .muted { color: #555; line-height: 1.5; }
  .invoice-title { text-align: right; }
  .invoice-title h1 { font-size: 24px; margin: 0 0 8px; letter-spacing: 1px; }
  .meta-grid { display: flex; justify-content: space-between; margin-bottom: 28px; }
  .meta-block h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #777; margin: 0 0 6px; }
  table.line-items { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  table.line-items th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #777; border-bottom: 1px solid #ddd; padding: 8px 0; }
  table.line-items td { padding: 12px 0; border-bottom: 1px solid #eee; }
  table.totals { width: 320px; margin-left: auto; margin-top: 16px; border-collapse: collapse; }
  table.totals td { padding: 6px 0; }
  table.totals .label { color: #555; }
  table.totals .value { text-align: right; font-variant-numeric: tabular-nums; }
  table.totals .total-row td { border-top: 2px solid #1a1a1a; font-weight: 700; font-size: 15px; padding-top: 10px; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #ddd; color: #777; font-size: 11px; line-height: 1.6; }
  .status-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; background: #e6f4ea; color: #1e7e34; font-weight: 700; font-size: 11px; text-transform: uppercase; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="seller-name">${escapeHtml(SELLER.name)}</div>
      <div class="muted">
        ${SELLER.addressLines.map(escapeHtml).join("<br/>")}<br/>
        GSTIN: ${SELLER.gstin} &nbsp;|&nbsp; PAN: ${SELLER.pan}<br/>
        CIN: ${SELLER.cin}
      </div>
    </div>
    <div class="invoice-title">
      <h1>TAX INVOICE</h1>
      <div class="status-badge">${escapeHtml(inv.status)}</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-block">
      <h3>Billed To</h3>
      <div class="muted">
        ${escapeHtml(inv.team.name)}<br/>
        ${escapeHtml(inv.user.name || inv.user.email)}<br/>
        ${escapeHtml(inv.user.email)}<br/>
        Billing Address: ${escapeHtml(billingAddress)}
      </div>
    </div>
    <div class="meta-block">
      <h3>Invoice Details</h3>
      <div class="muted">
        Invoice No: ${escapeHtml(inv.invoiceNumber)}<br/>
        Date: ${issueDate}<br/>
        Payment ID: ${escapeHtml(inv.paymentId)}<br/>
        ${inv.orderId ? `Order ID: ${escapeHtml(inv.orderId)}` : ""}
      </div>
    </div>
  </div>

  <table class="line-items">
    <thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>
      <tr><td>${escapeHtml(inv.description)}</td><td style="text-align:right">${formatMoney(inv.taxableValue ?? inv.amount, inv.currency)}</td></tr>
    </tbody>
  </table>

  <table class="totals">
    ${renderTaxSection(inv)}
    <tr class="total-row"><td class="label">Total Paid</td><td class="value">${formatMoney(inv.amount, inv.currency)}</td></tr>
  </table>

  <div class="footer">
    This is a system-generated invoice for a payment processed via Razorpay.<br/>
    ${escapeHtml(SELLER.name)} &middot; GSTIN ${SELLER.gstin}
  </div>
</body>
</html>`;
}

export async function renderInvoicePdf(invoice: InvoicePdfData): Promise<Buffer> {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
        await page.setContent(renderInvoiceHtml(invoice), { waitUntil: "load" });
        const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "0", bottom: "0", left: "0", right: "0" } });
        return Buffer.from(pdf);
    } finally {
        await page.close();
    }
}
