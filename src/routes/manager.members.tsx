import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { PageHero } from "@/components/page-hero";
import { StatStrip } from "@/components/stat-strip";
import { useSports } from "@/components/sports-ui";
import { Button, Card, EmptyState, Input, LoadError, Pagination, Select, Skeleton, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/arena3/labels";
import { cn } from "@/lib/cn";
import { ageYears } from "@/lib/arena3/time";
import { locale, t, tk } from "@/lib/i18n";
import { UserAvatar } from "@/components/user-avatar";
import { useRead } from "@/lib/use-read";
import { usePageState } from "@/lib/use-page-state";

export const Route = createFileRoute("/manager/members")({
  component: Page,
});

type Row = {
  id: string;
  member_code: string | null;
  full_name: string;
  phone: string;
  status: string;
  date_of_birth: string | null;
  avatar_url?: string | null;
  classes: number;
};

/** FR-MEM-04: every member, filtered by who they are. */
function Page() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [sport, setSport] = useState("");
  const { offset, setOffset, pageSize, setPageSize, reset } = usePageState("manager.members", 25);

  // Typing waits a beat so one search is one request, and any filter change goes back to page one.
  const [term, setTerm] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setTerm(q.trim()), 250);
    return () => clearTimeout(timer);
  }, [q]);
  useEffect(reset, [term, status, sport, reset]);

  const params = new URLSearchParams({ limit: String(pageSize), offset: String(offset) });
  if (term) params.set("q", term);
  if (status) params.set("status", status);
  if (sport) params.set("sport", sport);
  // The rows already on screen stay (dimmed) while the next page or filter loads, so paging does not
  // collapse the list; a failure replaces them with the reason rather than rows that do not match.
  const read = useRead<{ items: Row[]; total: number }>(`/directory/members?${params}`, { keepPrevious: true });
  const data = read.data;
  const total = data?.total ?? 0;

  const sports = useSports();
  return (
    <Shell role="manager">
      <PageHero
        slot="banner.manager"
        title={t("Members")}
        subtitle={t("Everyone with an account. Open a member for their classes, balance and attendance.")}
        className="mb-6"
      />

      <StatStrip
        stats={[
          { label: tk("Total members"), value: total },
        ]}
        className="mb-6"
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_10rem_10rem]">
        <Input
          placeholder={t("Name, phone or member code")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={t("Search members")}
        />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t("Account status")}>
          <option value="">{t("Any status")}</option>
          <option value="active">{t("Active")}</option>
          <option value="locked">{t("Locked")}</option>
          <option value="disabled">{t("Disabled")}</option>
        </Select>
        <Select value={sport} onChange={(e) => setSport(e.target.value)} aria-label={t("Sport")}>
          <option value="">{t("Any sport")}</option>
          {sports.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>

      <div aria-busy={read.stale} className={cn("transition-opacity", read.stale && "opacity-60")}>
      {read.error ? (
        <LoadError message={read.error.message} onRetry={read.error.refused ? undefined : read.reload} />
      ) : !data ? (
        <Skeleton className="h-48" />
      ) : !data.items.length ? (
        <EmptyState
          title={t("No members match")}
          hint={t("Loosen a filter or check the spelling.")}
          action={
            term || status || sport ? (
              <Button
                variant="outline"
                onClick={() => {
                  setQ("");
                  setStatus("");
                  setSport("");
                }}
              >
                {t("Clear filters")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="mb-2 text-sm text-muted tabular-nums">
            {total === 1 ? t("1 member") : t("{n} members", { n: total.toLocaleString(locale()) })}
          </p>
          <Card className="overflow-hidden p-0">
            <div className="hidden grid-cols-[minmax(0,1.6fr)_4rem_minmax(0,1.3fr)_5rem] gap-4 border-b border-line bg-wood/50 px-4 py-2 text-xs font-medium text-muted md:grid">
              <span>{t("Member")}</span>
              <span>{t("Age")}</span>
              <span>{t("Phone")}</span>
              <span className="text-right">{t("Classes")}</span>
            </div>
            <ul className="divide-y divide-line/70">
              {data.items.map((m) => (
                <li key={m.id}>
                  <Link
                    to="/desk/member/$id"
                    params={{ id: m.id }}
                    className="grid gap-x-4 gap-y-0.5 px-4 py-2.5 transition-colors duration-150 hover:bg-wood/60 md:grid-cols-[minmax(0,1.6fr)_4rem_minmax(0,1.3fr)_5rem] md:items-center"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-8 shrink-0">
                        <UserAvatar name={m.full_name} url={m.avatar_url} />
                      </div>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          <span className="break-words">{m.full_name}</span>
                          {m.status !== "active" ? <StatusBadge status={m.status} /> : null}
                        </p>
                        <p className="text-xs tabular-nums text-muted">
                          {m.member_code ?? "-"}
                          {m.date_of_birth ? ` · ${t("{age} yrs", { age: ageYears(m.date_of_birth) })}` : ""}
                        </p>
                      </div>
                    </div>
                    <p className="hidden text-sm tabular-nums text-muted md:block">
                      {m.date_of_birth ? ageYears(m.date_of_birth) : "-"}
                    </p>
                    <p className="text-sm tabular-nums text-muted">{m.phone}</p>
                    <p className="text-sm tabular-nums text-muted md:text-right">
                      {m.classes === 1 ? t("1 class") : t("{n} classes", { n: m.classes })}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Pagination offset={offset} total={total} pageSize={pageSize} onChange={setOffset} onPageSizeChange={setPageSize} label={t("Member pages")} />
        </>
      )}
      </div>
    </Shell>
  );
}
