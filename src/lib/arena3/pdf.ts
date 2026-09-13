import { unaccentVi } from "./phone";

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** Minimal single-page PDF 1.4 (WinAnsi). Vietnamese is unaccented. */
export function simplePdf(lines: string[], opts?: { width?: number; height?: number }): Uint8Array {
  const W = opts?.width ?? 420;
  const H = opts?.height ?? 595; // A5-ish
  const contentLines = lines.map((line, i) => {
    const y = H - 48 - i * 16;
    return `BT /F1 11 Tf 36 ${y} Td (${esc(unaccentVi(line))}) Tj ET`;
  });
  const stream = contentLines.join("\n");
  const objs: string[] = [];
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
  objs[3] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`;
  objs[4] = `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`;
  objs[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  let out = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let i = 1; i <= 5; i += 1) {
    offsets[i] = Buffer.byteLength(out);
    out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(out);
  out += `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i += 1) {
    out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out);
}

export function invoicePdfLines(inv: {
  code: string;
  issued_at: string;
  buyer_name: string;
  buyer_tax_code?: string | null;
  legal_name?: string | null;
  tax_code?: string | null;
  address?: string | null;
  pay_code: string;
  method: string;
  lines: { description: string; qty: number; unit_vnd: number; amount_vnd: number }[];
  total: number;
}): string[] {
  const rows: string[] = [
    inv.legal_name || "Arena3 Sports Center",
    inv.address || "TP. Ho Chi Minh",
    inv.tax_code ? `MST: ${inv.tax_code}` : "",
    "",
    `Hoa don ${inv.code}`,
    `Chung tu ${inv.pay_code}  •  ${inv.method}`,
    `Ngay: ${inv.issued_at}`,
    `Khach: ${inv.buyer_name}`,
    inv.buyer_tax_code ? `MST KH: ${inv.buyer_tax_code}` : "",
    "",
    "Hang hoa",
  ];
  for (const l of inv.lines) {
    rows.push(`${l.qty} x ${l.description}  ${l.amount_vnd.toLocaleString("vi-VN")}d`);
  }
  rows.push("");
  rows.push(`Tong cong: ${inv.total.toLocaleString("vi-VN")}d`);
  rows.push("");
  rows.push("Cam on quy khach.");
  return rows.filter((x, i, a) => x !== "" || a[i - 1] !== "");
}
