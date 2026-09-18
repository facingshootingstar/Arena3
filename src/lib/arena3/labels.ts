export const SPORT_LABEL: Record<string, string> = {
  badminton: "Badminton",
  basketball: "Basketball",
  volleyball: "Volleyball",
  all: "All 3 sports",
};

export const ROLE_LABEL: Record<string, string> = {
  manager: "Manager",
  receptionist: "Front desk",
  coach: "Coach",
  member: "Member",
};

export const LEVEL_LABEL: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  team: "Team",
  new: "Beginner",
  tb: "Intermediate",
  nc: "Advanced",
};

export const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  hold: "On hold",
  in_use: "Playing",
  cancelled: "Cancelled",
  completed: "Completed",
  noshow: "No-show",
  active: "Active",
  pending: "Unpaid",
  expired: "Expired",
  frozen: "Frozen",
  draft: "Draft",
  published: "Published",
  archived: "Archived",
  open: "Open",
  closed: "Closed",
  waitlisted: "Waitlisted",
  present: "Present",
  late: "Late",
  absent: "Absent",
  excused: "Excused",
  out: "Checked out",
  returned: "Returned",
};

export const KIND_LABEL: Record<string, string> = {
  hold: "Hold",
  booking: "Booking",
  session: "Class",
  maintenance: "Maintenance",
  convert: "Merged court",
};

export const DAY_KIND_LABEL: Record<string, string> = {
  weekday: "Weekday",
  weekend: "Weekend",
  holiday: "Holiday",
};

const BYDAY: Record<string, string> = {
  MO: "Mon",
  TU: "Tue",
  WE: "Wed",
  TH: "Thu",
  FR: "Fri",
  SA: "Sat",
  SU: "Sun",
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
  cash: "Cash",
  transfer: "Bank transfer",
  card: "Card",
  quota: "Plan hours",
};

export const SOURCE_LABEL: Record<string, string> = {
  court: "Court rental",
  booking: "Court rental",
  class: "Class",
  membership: "Plan",
  subscription: "Plan",
  walk_in: "Walk-in",
  other: "Other",
};

export function methodLabel(s: string) {
  return METHOD_LABEL[s] ?? s;
}

export function sourceLabel(s: string) {
  return SOURCE_LABEL[s] ?? s;
}

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** 2026-09-17 → 17 Sep 2026 */
export function formatDate(iso: string) {
  const day = iso.slice(0, 10);
  const [y, m, d] = day.split("-");
  if (!y || !m || !d) return iso;
  const month = MONTH_SHORT[Number(m) - 1];
  if (!month) return iso;
  return `${Number(d)} ${month} ${y}`;
}

export function addDaysISO(iso: string, days: number) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) + days));
  return dt.toISOString().slice(0, 10);
}

export function weekdayShort(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getUTCDay()] ?? "";
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
