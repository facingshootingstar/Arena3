export const SPORT_LABEL: Record<string, string> = {
  badminton: "Cầu lông",
  basketball: "Bóng rổ",
  volleyball: "Bóng chuyền",
  all: "Cả 3 môn",
};

export const ROLE_LABEL: Record<string, string> = {
  manager: "Quản lý",
  receptionist: "Lễ tân",
  coach: "Huấn luyện viên",
  member: "Thành viên",
};

export const LEVEL_LABEL: Record<string, string> = {
  beginner: "Mới",
  intermediate: "Trung bình",
  advanced: "Nâng cao",
  team: "Đội",
  new: "Mới",
  tb: "Trung bình",
  nc: "Nâng cao",
};

export const STATUS_LABEL: Record<string, string> = {
  confirmed: "Đã chốt",
  hold: "Giữ chỗ",
  in_use: "Đang chơi",
  cancelled: "Đã hủy",
  completed: "Hoàn tất",
  noshow: "Vắng",
  active: "Đang dùng",
  pending: "Chờ thu",
  expired: "Hết hạn",
  frozen: "Tạm khóa",
  draft: "Nháp",
  published: "Đang mở",
  archived: "Lưu trữ",
  open: "Mở",
  closed: "Đóng",
  waitlisted: "Danh sách chờ",
  present: "Có mặt",
  late: "Muộn",
  absent: "Vắng",
  excused: "Có phép",
  out: "Đang mang",
  returned: "Đã trả",
};

export const KIND_LABEL: Record<string, string> = {
  hold: "Giữ",
  booking: "Đặt",
  session: "Lớp",
  maintenance: "Bảo trì",
  convert: "Gộp sân",
};

export const DAY_KIND_LABEL: Record<string, string> = {
  weekday: "Ngày thường",
  weekend: "Cuối tuần",
  holiday: "Ngày lễ",
};

const BYDAY: Record<string, string> = {
  MO: "T2",
  TU: "T3",
  WE: "T4",
  TH: "T5",
  FR: "T6",
  SA: "T7",
  SU: "CN",
};

export function sportLabel(s: string) {
  return SPORT_LABEL[s] ?? s;
}

export function roleLabel(s: string) {
  return ROLE_LABEL[s] ?? s;
}

export function levelLabel(s: string) {
  return LEVEL_LABEL[s.toLowerCase()] ?? s;
}

export function statusLabel(s: string) {
  return STATUS_LABEL[s] ?? s;
}

export function kindLabel(s: string) {
  return KIND_LABEL[s] ?? s;
}

export function statusTone(s: string): "ink" | "accent" | "hold" | "muted" | "danger" {
  if (s === "hold" || s === "pending" || s === "waitlisted") return "hold";
  if (s === "cancelled" || s === "expired" || s === "noshow" || s === "frozen") return "danger";
  if (s === "confirmed" || s === "active" || s === "published" || s === "in_use" || s === "completed") return "accent";
  return "muted";
}

export const METHOD_LABEL: Record<string, string> = {
  cash: "Tiền mặt",
  transfer: "Chuyển khoản",
  card: "Thẻ",
  quota: "Giờ gói",
};

export const SOURCE_LABEL: Record<string, string> = {
  court: "Thuê sân",
  booking: "Thuê sân",
  class: "Lớp",
  membership: "Gói",
  subscription: "Gói",
  walk_in: "Khách vãng lai",
  other: "Khác",
};

export function methodLabel(s: string) {
  return METHOD_LABEL[s] ?? s;
}

export function sourceLabel(s: string) {
  return SOURCE_LABEL[s] ?? s;
}

export function formatViDate(iso: string) {
  const day = iso.slice(0, 10);
  const [y, m, d] = day.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function addDaysISO(iso: string, days: number) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) + days));
  return dt.toISOString().slice(0, 10);
}

export function weekdayShort(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  return ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][dt.getUTCDay()] ?? "";
}

export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** FREQ=WEEKLY;BYDAY=MO,WE;BYHOUR=18 → T2, T4 · 18:00 */
export function rruleLabel(rrule: string) {
  const parts = Object.fromEntries(
    rrule.split(";").map((p) => {
      const [k, v] = p.split("=");
      return [k ?? "", v ?? ""];
    }),
  );
  const days = (parts.BYDAY ?? "")
    .split(",")
    .map((d) => BYDAY[d.trim()] ?? d.trim())
    .filter(Boolean)
    .join(", ");
  const hour = parts.BYHOUR ? `${String(parts.BYHOUR).padStart(2, "0")}:00` : "";
  if (days && hour) return `${days} · ${hour}`;
  if (days) return days;
  return rrule;
}

export function composeWeeklyRrule(days: string[], hour: number) {
  const byday = days.join(",") || "MO";
  return `FREQ=WEEKLY;BYDAY=${byday};BYHOUR=${hour}`;
}

export function parseWeeklyRrule(rrule: string): { days: string[]; hour: number } {
  const parts = Object.fromEntries(
    rrule.split(";").map((p) => {
      const [k, v] = p.split("=");
      return [k ?? "", v ?? ""];
    }),
  );
  const days = (parts.BYDAY ?? "MO")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
  return { days, hour: Number(parts.BYHOUR ?? 18) };
}
