export type ThermalReceiptItem = {
  name: string;
  quantity: number;
  unitPrice: number;
};

export type ThermalReceiptData = {
  billNumber?: string | null;
  customerName: string;
  customerPhone: string;
  createdAt: Date;
  paymentMode: string;
  items: ThermalReceiptItem[];
  subtotal: number;
  gst: number;
  total: number;
  discount: number;
  payable: number;
  received: number;
};

type ReceiptLine = {
  text: string;
  size: number;
  bold?: boolean;
  red?: boolean;
  align?: "left" | "center" | "right";
  rightText?: string;
  columns?: Array<{ text: string; width: number; align?: "left" | "right"; bold?: boolean }>;
  divider?: boolean;
  gap?: number;
};

const HELVETICA_CHAR_WIDTHS: Record<string, number> = {
  " ": 278, "!": 278, '"': 355, "#": 556, "$": 556, "%": 889, "&": 667, "'": 222,
  "(": 333, ")": 333, "*": 389, "+": 584, ",": 278, "-": 333, ".": 278, "/": 278,
  "0": 556, "1": 556, "2": 556, "3": 556, "4": 556, "5": 556, "6": 556, "7": 556, "8": 556, "9": 556,
  ":": 278, ";": 278, "<": 584, "=": 584, ">": 584, "?": 556, "@": 1015,
  "A": 667, "B": 667, "C": 722, "D": 722, "E": 667, "F": 611, "G": 778, "H": 722, "I": 278, "J": 500,
  "K": 667, "L": 556, "M": 833, "N": 722, "O": 778, "P": 667, "Q": 778, "R": 722, "S": 667, "T": 611,
  "U": 722, "V": 667, "W": 944, "X": 667, "Y": 667, "Z": 611,
  "[": 278, "\\": 278, "]": 278, "^": 469, "_": 556, "`": 222,
  "a": 556, "b": 556, "c": 500, "d": 556, "e": 556, "f": 278, "g": 556, "h": 556, "i": 222, "j": 222,
  "k": 500, "l": 222, "m": 833, "n": 556, "o": 556, "p": 556, "q": 556, "r": 333, "s": 500, "t": 278,
  "u": 556, "v": 500, "w": 722, "x": 500, "y": 500, "z": 500,
};

function measureText(text: string, size: number, bold = false): number {
  let totalUnits = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const unit = HELVETICA_CHAR_WIDTHS[ch] ?? 556;
    totalUnits += bold ? unit * 1.05 : unit;
  }
  return (totalUnits * size) / 1000;
}

function toPdfAscii(value: string): string {
  return value.normalize("NFKD").replace(/[^\x20-\x7E]/g, "?");
}

function pdfSafeText(value: string): string {
  return toPdfAscii(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function wrapText(value: string, maxLength: number): string[] {
  const words = toPdfAscii(value).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxLength && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function money(value: number): string {
  return `INR ${Number(value || 0).toFixed(2)}`;
}

export function createThermalReceiptPdf(data: ThermalReceiptData): Blob {
  const colItemWidth = 88;
  const colQtyWidth = 28;
  const colPriceWidth = 44;
  const colTotalWidth = 46.77;

  const lines: ReceiptLine[] = [
    { text: "KHERWAL BAZAAR", size: 13, bold: true, align: "center", gap: 0 },
    { text: "SALES BILL", size: 9, align: "center", gap: 2 },
    ...(data.billNumber ? [{ text: `Bill: ${data.billNumber}`, size: 8, gap: 3 }] : []),
    { text: `Customer: ${data.customerName}`, size: 8 },
    { text: `Mobile: ${data.customerPhone}`, size: 8 },
    { text: `Date: ${data.createdAt.toLocaleString("en-IN")}`, size: 8 },
    { text: `Payment: ${data.paymentMode}`, size: 8 },
    { text: "", size: 5, divider: true, gap: 3 },
  ];

  lines.push({
    text: "",
    size: 7.5,
    red: true,
    bold: true,
    gap: 2,
    columns: [
      { text: "Item", width: colItemWidth, bold: true },
      { text: "Quantity", width: colQtyWidth, align: "right", bold: true },
      { text: "Unit Price", width: colPriceWidth, align: "right", bold: true },
      { text: "Total", width: colTotalWidth, align: "right", bold: true },
    ],
  });

  for (const item of data.items) {
    const itemLines = wrapText(item.name, 22);
    itemLines.forEach((name, index) => lines.push({
      text: "",
      size: 7.5,
      gap: index === 0 ? 1 : 0,
      columns: [
        { text: name, width: colItemWidth, bold: true },
        { text: index === 0 ? String(item.quantity) : "", width: colQtyWidth, align: "right" },
        { text: index === 0 ? item.unitPrice.toFixed(2) : "", width: colPriceWidth, align: "right" },
        { text: index === 0 ? (item.quantity * item.unitPrice).toFixed(2) : "", width: colTotalWidth, align: "right" },
      ],
    }));
  }

  lines.push(
    { text: "", size: 5, divider: true, gap: 3 },
    { text: "Subtotal", rightText: money(data.subtotal), size: 8 },
    { text: "GST", rightText: money(data.gst), size: 8 },
    { text: "Total", rightText: money(data.total), size: 8 },
    { text: "Discount", rightText: `- ${money(data.discount)}`, size: 8 },
    { text: "NET PAY", rightText: money(data.payable), size: 11, bold: true, red: true, gap: 2 },
    { text: "Received", rightText: money(data.received), size: 8, gap: 2 },
    { text: "Balance", rightText: money(Math.max(0, data.payable - data.received)), size: 8 },
    { text: "Thank you for shopping!", size: 8, align: "center", gap: 7 },
  );

  const pageWidth = 226.77; // 80 mm thermal paper
  const pageHeight = lines.reduce((height, line) => height + (line.gap ?? 0) + (line.divider ? 8 : line.size + 4), 22);
  let y = pageHeight - 14;
  const commands: string[] = [];
  for (const line of lines) {
    y -= line.gap ?? 0;
    if (line.divider) {
      y -= 3;
      commands.push(`0.6 w 10 ${y.toFixed(2)} m ${(pageWidth - 10).toFixed(2)} ${y.toFixed(2)} l S`);
      y -= 5;
      continue;
    }

    if (line.red) commands.push("1 0 0 rg");
    const font = line.bold ? "F2" : "F1";
    if (line.text) {
      const estimatedWidth = measureText(line.text, line.size, Boolean(line.bold));
      const x = line.align === "center"
        ? Math.max(10, (pageWidth - estimatedWidth) / 2)
        : line.align === "right"
          ? Math.max(10, pageWidth - 10 - estimatedWidth)
          : 10;
      commands.push(`BT /${font} ${line.size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfSafeText(line.text)}) Tj ET`);
    }
    if (line.rightText) {
      const rightWidth = measureText(line.rightText, line.size, Boolean(line.bold));
      commands.push(`BT /${line.bold ? "F2" : "F1"} ${line.size} Tf 1 0 0 1 ${(pageWidth - 10 - rightWidth).toFixed(2)} ${y.toFixed(2)} Tm (${pdfSafeText(line.rightText)}) Tj ET`);
    }
    if (line.columns) {
      let columnX = 10;
      for (const column of line.columns) {
        if (column.text) {
          const colFont = column.bold ? "F2" : font;
          const colWidth = measureText(column.text, line.size, Boolean(column.bold));
          const columnTextX = column.align === "right"
            ? columnX + column.width - colWidth
            : columnX;
          commands.push(`BT /${colFont} ${line.size} Tf 1 0 0 1 ${columnTextX.toFixed(2)} ${y.toFixed(2)} Tm (${pdfSafeText(column.text)}) Tj ET`);
        }
        columnX += column.width;
      }
    }
    if (line.red) commands.push("0 0 0 rg");
    y -= line.size + 4;
  }

  const stream = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight.toFixed(2)}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n%Thermal receipt\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}
