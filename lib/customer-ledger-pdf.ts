export interface LedgerBillEntry {
  createdAt: number;
  date?: string;
  name: string;
  amount: number;
  type: "gave" | "got";
}

export interface LedgerBillCustomer {
  name: string;
  phone: string;
  address?: string;
  collectionType?: string;
}

export interface ComputedLedgerEntry extends LedgerBillEntry {
  balance: number;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return ch;
    }
  });
}

export function formatWhatsAppPhone(phone: string): string {
  const digits = (phone || "").replace(/[^\d+]/g, "");
  if (!digits) return "";
  if (digits.startsWith("+")) return digits.slice(1);
  if (digits.startsWith("91") && digits.length === 12) return digits;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function computeLedgerEntries(entries: LedgerBillEntry[]) {
  const sorted = [...entries].sort((a, b) => a.createdAt - b.createdAt);
  let running = 0;
  const withBalance: ComputedLedgerEntry[] = sorted.map((e) => {
    if (e.type === "gave") running += e.amount;
    else running -= e.amount;
    return { ...e, balance: running };
  });
  const grandDebit = withBalance
    .filter((e) => e.type === "gave")
    .reduce((sum, e) => sum + e.amount, 0);
  const grandCredit = withBalance
    .filter((e) => e.type === "got")
    .reduce((sum, e) => sum + e.amount, 0);
  const finalBalance = grandDebit - grandCredit;

  return { withBalance, grandDebit, grandCredit, finalBalance };
}

export function buildWhatsAppBillText(
  customer: LedgerBillCustomer,
  entries: LedgerBillEntry[]
): string {
  const { withBalance, grandDebit, grandCredit, finalBalance } =
    computeLedgerEntries(entries);
  const recent = withBalance.slice(-10);
  const lines = recent.map((e) => {
    const d = new Date(e.createdAt || Date.now());
    const ds = `${d.getDate()} ${d.toLocaleString("en-IN", { month: "short" })}`;
    const sign = e.type === "gave" ? "Debit" : "Paid";
    return `• ${ds} | ${e.name}: ₹${e.amount.toLocaleString("en-IN")} (${sign})`;
  });

  const absBal = Math.abs(finalBalance);
  const balLabel =
    finalBalance > 0
      ? `*Pending Due: ₹${absBal.toLocaleString("en-IN")}*`
      : finalBalance < 0
        ? `*Advance Balance: ₹${absBal.toLocaleString("en-IN")}*`
        : `*Account Settled (₹0)*`;

  const payLink = `upi://pay?pa=9583252256-3@axl&pn=KHERWAL%20BAZAAR&am=${absBal}&cu=INR`;

  return [
    `🧾 *KHERWAL BAZAAR - Customer Bill*`,
    ``,
    `👤 *Customer:* ${customer.name}`,
    `📞 *Mobile:* ${customer.phone || "N/A"}`,
    ``,
    `Total Purchase: ₹${grandDebit.toLocaleString("en-IN")}`,
    `Total Paid: ₹${grandCredit.toLocaleString("en-IN")}`,
    balLabel,
    ...(lines.length > 0
      ? ["", "*Recent Entries:*", ...lines]
      : []),
    ...(finalBalance > 0 ? ["", `📱 *Pay via UPI:* ${payLink}`] : []),
    ``,
    `📎 _(PDF bill downloaded — please attach if sharing document)_`,
    `– KHERWAL BAZAAR`,
  ].join("\n");
}

export async function createCustomerLedgerPdf(
  customer: LedgerBillCustomer,
  entries: LedgerBillEntry[]
) {
  const { jsPDF } = await import("jspdf");
  const { withBalance, grandDebit, grandCredit, finalBalance } =
    computeLedgerEntries(entries);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = 210;
  const m = 12;
  const cw = pw - 2 * m;
  const blue = [30, 58, 95] as const;
  const nextPageIfNeeded = (y: number) => (y > 280 ? (doc.addPage(), m) : y);

  // Header bar
  doc.setFillColor(...blue);
  doc.rect(0, 0, pw, 38, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("KHERWAL BAZAAR", pw / 2, 17, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("UDHAR RECOVERY SYSTEM", pw / 2, 25, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(147, 197, 253);
  doc.text("CUSTOMER LEDGER BILL", pw / 2, 35, { align: "center" });

  let y = 46;
  // Customer info
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(m, y, cw, customer.address ? 30 : 24, 2, 2, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...blue);
  doc.text(`Customer Name : ${customer.name}`, m + 4, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(55, 65, 81);
  doc.text(`Phone Number  : ${customer.phone || "N/A"}`, m + 4, y + 17);
  if (customer.address) {
    doc.text(`Address       : ${customer.address}`, m + 4, y + 25);
  }
  y += customer.address ? 36 : 30;

  // Summary boxes
  const half = cw / 2 - 3;
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(m, y, half, 20, 2, 2, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(107, 114, 128);
  doc.text("Summary Period", m + 4, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(55, 65, 81);
  const fd = withBalance.length
    ? new Date(withBalance[0].createdAt || Date.now())
    : new Date();
  const ld = withBalance.length
    ? new Date(withBalance[withBalance.length - 1].createdAt || Date.now())
    : new Date();
  doc.text(
    `${fd.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}  ->  ${ld.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`,
    m + 4,
    y + 15
  );

  doc.setFillColor(243, 244, 246);
  doc.roundedRect(m + half + 6, y, half, 20, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(107, 114, 128);
  doc.text("No. of Entries", m + half + 10, y + 7);
  doc.setFontSize(12);
  doc.setTextColor(...blue);
  doc.text(`${withBalance.length}`, m + half + 10, y + 16);
  y += 28;

  // Table header
  const cx = [m, m + 26, m + 72, m + 114, m + 156];
  doc.setFillColor(...blue);
  doc.rect(m, y, cw, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text("Date", cx[0] + 2, y + 5);
  doc.text("Details", cx[1] + 2, y + 5);
  doc.text("Debit (-)", cx[2] + 2, y + 5);
  doc.text("Credit (+)", cx[3] + 2, y + 5);
  doc.text("Balance", cx[4] + 2, y + 5);
  y += 7;

  // Rows
  for (let i = 0; i < withBalance.length; i += 1) {
    y = nextPageIfNeeded(y);
    const e = withBalance[i];
    const d = new Date(e.createdAt || Date.now());
    const ds = `${d.getDate()} ${d.toLocaleString("default", { month: "short" })}`;
    const isGave = e.type === "gave";
    const bal = e.balance;
    if (i % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(m, y, cw, 6, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(55, 65, 81);
    doc.text(ds, cx[0] + 2, y + 4);
    doc.text(
      e.name.length > 22 ? `${e.name.substring(0, 20)}..` : e.name,
      cx[1] + 2,
      y + 4
    );
    if (isGave) {
      doc.setTextColor(220, 38, 38);
      doc.text(`Rs.${e.amount}`, cx[2] + 2, y + 4);
    } else {
      doc.setTextColor(22, 163, 74);
      doc.text(`Rs.${e.amount}`, cx[3] + 2, y + 4);
    }
    if (bal > 0) doc.setTextColor(220, 38, 38);
    else if (bal < 0) doc.setTextColor(22, 163, 74);
    else doc.setTextColor(107, 114, 128);
    doc.setFont("helvetica", "bold");
    doc.text(`Rs.${Math.abs(bal)}`, cx[4] + 2, y + 4);
    y += 6;
  }

  // Grand total
  y = nextPageIfNeeded(y + 3);
  doc.setFillColor(...blue);
  doc.rect(m, y, cw, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("GRAND TOTAL", cx[0] + 2, y + 5.5);
  doc.text(`Rs.${grandDebit}`, cx[2] + 2, y + 5.5);
  doc.text(`Rs.${grandCredit}`, cx[3] + 2, y + 5.5);
  const fbCol =
    finalBalance > 0
      ? [255, 100, 100]
      : finalBalance < 0
        ? [134, 239, 128]
        : [200, 200, 200];
  doc.setTextColor(fbCol[0], fbCol[1], fbCol[2]);
  doc.text(`Rs.${Math.abs(finalBalance)}`, cx[4] + 2, y + 5.5);
  y += 14;

  // Footer
  const now = new Date();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(107, 114, 128);
  doc.setDrawColor(...blue);
  doc.setLineWidth(0.5);
  doc.line(m, y - 4, pw - m, y - 4);
  doc.text(
    `Report Generated: ${now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} | ${now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`,
    m,
    y
  );
  doc.text("Generated by: KHERWAL BAZAAR - Udhar Recovery System", m, y + 4);

  const safeName = (customer.name || "Customer").replace(/\s+/g, "_");
  const fileName = `${safeName}_Bill.pdf`;
  const blob = doc.output("blob");

  return { doc, blob, fileName, grandDebit, grandCredit, finalBalance };
}

export function printCustomerLedgerBill(
  customer: LedgerBillCustomer,
  entries: LedgerBillEntry[]
): boolean {
  const { withBalance, grandDebit, grandCredit, finalBalance } =
    computeLedgerEntries(entries);
  const printWindow = window.open("", "_blank", "width=840,height=900");
  if (!printWindow) return false;

  const rowsHtml =
    withBalance.length === 0
      ? `<tr><td colspan="5" style="text-align:center;padding:18px;color:#64748b;">No transactions recorded.</td></tr>`
      : withBalance
          .map((e, i) => {
            const d = new Date(e.createdAt || Date.now());
            const ds = d.toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            });
            const isGave = e.type === "gave";
            return `<tr style="background:${i % 2 === 0 ? "#ffffff" : "#f8fafc"}">
              <td>${escapeHtml(ds)}</td>
              <td>${escapeHtml(e.name)}</td>
              <td style="text-align:right;color:#dc2626;font-weight:600">${isGave ? `₹${e.amount.toLocaleString("en-IN")}` : "—"}</td>
              <td style="text-align:right;color:#16a34a;font-weight:600">${!isGave ? `₹${e.amount.toLocaleString("en-IN")}` : "—"}</td>
              <td style="text-align:right;font-weight:700;color:${e.balance > 0 ? "#dc2626" : e.balance < 0 ? "#16a34a" : "#64748b"}">₹${Math.abs(e.balance).toLocaleString("en-IN")}</td>
            </tr>`;
          })
          .join("");

  const now = new Date();
  const balTag =
    finalBalance > 0 ? "(Due)" : finalBalance < 0 ? "(Advance)" : "(Clear)";

  printWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(customer.name)} - Customer Bill</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; padding: 0; }
    .header { background: #1e3a5f; color: #fff; padding: 18px; text-align: center; border-radius: 8px; }
    .header h1 { margin: 0; font-size: 22px; letter-spacing: 0.5px; }
    .header p { margin: 4px 0 0; font-size: 11px; color: #93c5fd; font-weight: 700; letter-spacing: 1px; }
    .info { margin-top: 14px; background: #f1f5f9; padding: 12px 14px; border-radius: 8px; display: flex; justify-content: space-between; font-size: 12px; }
    .cards { margin-top: 12px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center; }
    .card small { display: block; font-size: 10px; color: #64748b; text-transform: uppercase; }
    .card strong { font-size: 16px; display: block; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 11px; }
    th { background: #1e3a5f; color: #fff; padding: 8px; text-align: left; }
    td { border-bottom: 1px solid #e2e8f0; padding: 7px 8px; }
    .total-row td { background: #1e3a5f; color: #fff; font-weight: 700; }
    .footer { margin-top: 16px; padding-top: 8px; border-top: 1px solid #cbd5e1; font-size: 10px; color: #64748b; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="header">
    <h1>KHERWAL BAZAAR</h1>
    <p>UDHAR RECOVERY SYSTEM · CUSTOMER LEDGER BILL</p>
  </div>
  <div class="info">
    <div>
      <div><strong>Customer:</strong> ${escapeHtml(customer.name)}</div>
      <div style="margin-top:4px;"><strong>Phone:</strong> ${escapeHtml(customer.phone || "N/A")}</div>
      ${customer.address ? `<div style="margin-top:4px;"><strong>Address:</strong> ${escapeHtml(customer.address)}</div>` : ""}
    </div>
    <div style="text-align:right;">
      <div><strong>Entries:</strong> ${withBalance.length}</div>
      <div style="margin-top:4px;"><strong>Date:</strong> ${escapeHtml(now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }))}</div>
    </div>
  </div>
  <div class="cards">
    <div class="card"><small>Total Purchase</small><strong style="color:#dc2626">₹${grandDebit.toLocaleString("en-IN")}</strong></div>
    <div class="card"><small>Total Paid</small><strong style="color:#16a34a">₹${grandCredit.toLocaleString("en-IN")}</strong></div>
    <div class="card"><small>Net Balance ${balTag}</small><strong style="color:${finalBalance > 0 ? "#dc2626" : finalBalance < 0 ? "#16a34a" : "#0f172a"}">₹${Math.abs(finalBalance).toLocaleString("en-IN")}</strong></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Details</th>
        <th style="text-align:right">Debit (-)</th>
        <th style="text-align:right">Credit (+)</th>
        <th style="text-align:right">Balance</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      <tr class="total-row">
        <td colspan="2">GRAND TOTAL</td>
        <td style="text-align:right">₹${grandDebit.toLocaleString("en-IN")}</td>
        <td style="text-align:right">₹${grandCredit.toLocaleString("en-IN")}</td>
        <td style="text-align:right">₹${Math.abs(finalBalance).toLocaleString("en-IN")}</td>
      </tr>
    </tbody>
  </table>
  <div class="footer">
    <span>Generated: ${escapeHtml(now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }))}</span>
    <span>KHERWAL BAZAAR - Udhar Recovery System</span>
  </div>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`);
  printWindow.document.close();
  return true;
}
