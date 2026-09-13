import { createServerFn } from "@tanstack/react-start";

export type CatalogPlan = {
  id: string;
  name: string;
  sport_scope: string;
  duration_days: number | null;
  session_quota: number | null;
  court_hours: number;
  court_discount_pct: number;
  price_vnd: number;
};

export type CatalogClass = {
  id: string;
  sport: string;
  level: string;
  capacity: number;
  enrolled_count: number;
  court_code: string;
  coach_name: string;
  rrule: string;
  duration_min: number;
};

export type CatalogPrice = {
  sport: string;
  day_kind: string;
  start_local: string;
  end_local: string;
  price_vnd: number;
  is_peak: boolean;
  court_id?: string | null;
};

export const getPublicCatalog = createServerFn({ method: "POST" }).handler(async () => {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const [plans, classes, prices] = await Promise.all([
    sql.query<CatalogPlan>(
      `select id, name, sport_scope, duration_days, session_quota, court_hours,
              court_discount_pct, price_vnd
         from membership_plans
        where is_on_sale = true
        order by price_vnd`,
    ),
    sql.query<CatalogClass>(
      `select cl.id, cl.sport, cl.level, cl.capacity, cl.enrolled_count, cl.rrule, cl.duration_min,
              c.court_code, u.full_name as coach_name
         from classes cl
         join courts c on c.id = cl.court_id
         join users u on u.id = cl.coach_id
        where cl.status = 'open'
        order by cl.start_on, cl.level`,
    ),
    sql.query<CatalogPrice>(
      `select sport, court_id, day_kind, start_local::text, end_local::text, price_vnd, is_peak
         from price_rules
        order by sport, day_kind, start_local`,
    ),
  ]);
  return { plans, classes, prices };
});
