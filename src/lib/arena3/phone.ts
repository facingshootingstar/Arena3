export function normalizePhone(raw: string): string {
  const p = raw.trim().replace(/[\s-]/g, "");
  if (p.startsWith("+84")) return p;
  if (p.startsWith("84")) return `+${p}`;
  if (p.startsWith("0")) return `+84${p.slice(1)}`;
  return p;
}

export function isValidVnPhone(p: string): boolean {
  return /^\+84[3-9]\d{8}$/.test(p);
}

export function unaccentVi(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function passwordOk(pw: string): boolean {
  return pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
}
