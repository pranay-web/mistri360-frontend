import { useEffect } from "react";
import { Link } from "wouter";
import {
  useGetFleetSummary,
  useGetDashboardFleetStatus,
  useGetDashboardPmCompliance,
  useGetDashboardVehicleUrgency,
  useGetDashboardSummaryExtended,
  getGetFleetSummaryQueryKey,
  getGetDashboardFleetStatusQueryKey,
  getGetDashboardPmComplianceQueryKey,
  getGetDashboardVehicleUrgencyQueryKey,
  getGetDashboardSummaryExtendedQueryKey,
  useGetFleetTypeSummary,
  getGetFleetTypeSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  AlertTriangle,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Truck,
  Wrench,
  Zap,
  DollarSign,
  CalendarDays,
  ArrowRight,
  RefreshCw,
  Container,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Colour helpers ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  available:     "#22C55E",
  in_repair:     "#F59E0B",
  out_of_service:"#DC2626",
  restricted:    "#F97316",
  inactive:      "#6B7280",
};

const URGENCY_COLORS = {
  critical: "border-l-red-500 bg-red-950/10",
  warning:  "border-l-amber-500 bg-amber-950/10",
  ok:       "border-l-green-500/30 bg-transparent",
};

// ── Icon palette ──────────────────────────────────────────────────────────────

const ICON_PALETTE: Record<string, { bg: string; color: string }> = {
  default: { bg: "hsl(220 14% 93%)",  color: "hsl(220 12% 46%)" },
  green:   { bg: "hsl(142 60% 94%)",  color: "hsl(142 60% 32%)" },
  red:     { bg: "hsl(0 80% 95%)",    color: "hsl(0 68% 44%)" },
  amber:   { bg: "hsl(38 90% 93%)",   color: "hsl(38 78% 38%)" },
  orange:  { bg: "hsl(25 90% 93%)",   color: "hsl(25 85% 40%)" },
  blue:    { bg: "hsl(222 80% 95%)",  color: "hsl(222 62% 38%)" },
  purple:  { bg: "hsl(270 60% 95%)",  color: "hsl(270 50% 42%)" },
  teal:    { bg: "hsl(175 60% 93%)",  color: "hsl(175 55% 28%)" },
};

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({
  title, value, icon: Icon, iconPalette = "default", isLoading, sub,
}: {
  title: string;
  value?: number | string;
  icon: React.ElementType;
  iconPalette?: keyof typeof ICON_PALETTE;
  isLoading: boolean;
  sub?: string;
}) {
  const pal = ICON_PALETTE[iconPalette] ?? ICON_PALETTE.default;
  const numericVal = typeof value === "number" ? value : undefined;
  const hasAlert =
    numericVal !== undefined &&
    numericVal > 0 &&
    iconPalette !== "green" &&
    iconPalette !== "blue" &&
    iconPalette !== "teal" &&
    iconPalette !== "default";

  return (
    <Card className={cn("relative overflow-hidden border transition-shadow hover:shadow-md", hasAlert && "border-l-2 border-l-amber-400/60")}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">{title}</p>
            {isLoading ? (
              <Skeleton className="h-8 w-20 mt-1" />
            ) : (
              <p className="text-3xl font-bold font-mono tracking-tighter leading-none">
                {value !== undefined ? value : "—"}
              </p>
            )}
            {sub && <p className="text-xs text-muted-foreground mt-2">{sub}</p>}
          </div>
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: pal.bg }}
          >
            <Icon className="h-5 w-5" style={{ color: pal.color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Fleet section card (Trucks or Trailers) ───────────────────────────────────

function FleetTypeSection({
  label,
  icon: Icon,
  accentColor,
  data,
  isLoading,
}: {
  label: string;
  icon: React.ElementType;
  accentColor: string;
  data: { total: number; available: number; inRepair: number; outOfService: number; restricted: number } | undefined;
  isLoading: boolean;
}) {
  const stats = [
    { key: "available",      label: "Available",       color: STATUS_COLORS.available,      textClass: "text-green-600" },
    { key: "inRepair",       label: "In Repair",       color: STATUS_COLORS.in_repair,      textClass: "text-amber-600" },
    { key: "outOfService",   label: "Out of Service",  color: STATUS_COLORS.out_of_service, textClass: "text-red-600" },
    { key: "restricted",     label: "Restricted",      color: STATUS_COLORS.restricted,     textClass: "text-orange-600" },
  ] as const;

  const pieData = stats
    .map((s) => ({ name: s.label, value: data?.[s.key] ?? 0, fill: s.color }))
    .filter((d) => d.value > 0);

  const other = (data?.total ?? 0) - (data?.available ?? 0) - (data?.inRepair ?? 0) - (data?.outOfService ?? 0) - (data?.restricted ?? 0);

  return (
    <Card className="overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b" style={{ borderLeftWidth: 3, borderLeftColor: accentColor }}>
        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: accentColor + "20" }}>
          <Icon className="h-4 w-4" style={{ color: accentColor }} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">{label}</p>
          {isLoading ? (
            <Skeleton className="h-3 w-16 mt-0.5" />
          ) : (
            <p className="text-xs text-muted-foreground">{data?.total ?? 0} units</p>
          )}
        </div>
        {!isLoading && data && (
          <Badge variant="outline" className="text-xs font-mono font-semibold">
            {data.available} / {data.total} ready
          </Badge>
        )}
      </div>

      <CardContent className="p-0">
        <div className="grid grid-cols-2 divide-x divide-border/50">
          {/* Stat grid */}
          <div className="grid grid-cols-2 divide-y divide-border/30">
            {stats.map((s) => (
              <div key={s.key} className="px-4 py-3 flex flex-col gap-0.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</span>
                {isLoading ? (
                  <Skeleton className="h-6 w-10 mt-0.5" />
                ) : (
                  <span className={cn("text-xl font-bold font-mono", s.textClass)}>
                    {data?.[s.key] ?? 0}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Donut */}
          <div className="flex items-center justify-center p-2 h-36">
            {isLoading ? (
              <Skeleton className="h-28 w-28 rounded-full" />
            ) : pieData.length === 0 ? (
              <p className="text-xs text-muted-foreground">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={36}
                    outerRadius={56}
                    dataKey="value"
                    paddingAngle={2}
                    stroke="none"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0];
                      return (
                        <div className="rounded-lg border bg-card px-2.5 py-1.5 text-xs shadow-xl">
                          <span style={{ color: p.payload.fill }} className="font-semibold">{p.name}</span>
                          {": "}
                          <span className="font-bold">{p.value}</span>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        {/* "Other" row (inactive etc.) */}
        {!isLoading && other > 0 && (
          <div className="px-4 py-1.5 border-t text-xs text-muted-foreground">
            +{other} inactive / other
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.fill ?? p.color }}>
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ── Vehicle urgency strip ─────────────────────────────────────────────────────

function UrgencyStrip({ urgency }: { urgency: "critical" | "warning" | "ok" }) {
  return (
    <div className={cn("w-1 h-full rounded-full shrink-0", {
      "bg-red-500":      urgency === "critical",
      "bg-amber-500":    urgency === "warning",
      "bg-green-500/40": urgency === "ok",
    })} />
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const qc = useQueryClient();

  const summaryQK   = getGetFleetSummaryQueryKey();
  const fleetStatusQK = getGetDashboardFleetStatusQueryKey();
  const pmCompQK    = getGetDashboardPmComplianceQueryKey();
  const urgencyQK   = getGetDashboardVehicleUrgencyQueryKey();
  const extQK       = getGetDashboardSummaryExtendedQueryKey();
  const typeSumQK   = getGetFleetTypeSummaryQueryKey();

  const { data: summary,    isLoading: loadS  } = useGetFleetSummary({ query: { queryKey: summaryQK,   refetchInterval: 60_000 } });
  const { data: pmComp,     isLoading: loadPC } = useGetDashboardPmCompliance({ query: { queryKey: pmCompQK,  refetchInterval: 60_000 } });
  const { data: urgencyList = [], isLoading: loadU } = useGetDashboardVehicleUrgency({ query: { queryKey: urgencyQK, refetchInterval: 60_000 } });
  const { data: extended,   isLoading: loadE  } = useGetDashboardSummaryExtended({ query: { queryKey: extQK,      refetchInterval: 60_000 } });
  const { data: typeSum,    isLoading: loadTS } = useGetFleetTypeSummary({ query: { queryKey: typeSumQK, refetchInterval: 60_000 } });

  const donutData = ((pmComp as any)?.slices ?? []).filter((s: any) => s.value > 0);

  const refresh = () => {
    [summaryQK, fleetStatusQK, pmCompQK, urgencyQK, extQK, typeSumQK].forEach((k) =>
      qc.invalidateQueries({ queryKey: k })
    );
  };

  return (
    <div className="space-y-6">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Fleet Overview</h2>
          <p className="text-muted-foreground text-sm">Live operations and maintenance metrics · auto-refreshes every 60 s</p>
        </div>
        <button onClick={refresh} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* ── Row 1: Trucks & Trailers side-by-side ────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        <FleetTypeSection
          label="Power Units (Trucks)"
          icon={Truck}
          accentColor="#3B82F6"
          data={(typeSum as any)?.trucks}
          isLoading={loadTS}
        />
        <FleetTypeSection
          label="Trailers (Dry Van 53′)"
          icon={Container}
          accentColor="#8B5CF6"
          data={(typeSum as any)?.trailers}
          isLoading={loadTS}
        />
      </div>

      {/* ── Row 2: PM & compliance KPIs ──────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Maintenance Alerts</p>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <KpiCard title="Overdue PM1"  value={summary?.overduepm1}  isLoading={loadS} icon={Clock}         iconPalette={(summary?.overduepm1  ?? 0) > 0 ? "red"   : "default"} />
          <KpiCard title="Overdue PM2"  value={summary?.overduepm2}  isLoading={loadS} icon={Clock}         iconPalette={(summary?.overduepm2  ?? 0) > 0 ? "red"   : "default"} />
          <KpiCard title="Open Defects" value={summary?.openDefects} isLoading={loadS} icon={ShieldAlert}   iconPalette={(summary?.openDefects ?? 0) > 0 ? "red"   : "default"} />
          <KpiCard title="Restricted"   value={summary?.restricted}  isLoading={loadS} icon={AlertTriangle} iconPalette={(summary?.restricted  ?? 0) > 0 ? "amber" : "default"} />
        </div>
      </div>

      {/* ── Row 3: Inspection + financial ────────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        <KpiCard title="PMCVI Expiring (30d)" value={summary?.upcomingPmcvi30Days}          isLoading={loadS} icon={CalendarDays} iconPalette={(summary?.upcomingPmcvi30Days ?? 0) > 0 ? "amber" : "default"} />
        <KpiCard title="Breakdowns (30d)"     value={(extended as any)?.breakdowns30Days}    isLoading={loadE} icon={Zap}          iconPalette={(extended as any)?.breakdowns30Days > 0 ? "orange" : "default"} />
        <KpiCard
          title="Cost MTD"
          value={(extended as any)?.costMtd != null ? `$${Math.round((extended as any).costMtd).toLocaleString()}` : undefined}
          isLoading={loadE}
          icon={DollarSign}
          iconPalette="purple"
          sub="Parts + estimated labour"
        />
      </div>

      {/* ── Row 4: PM compliance donut + urgency list ────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">

        {/* PM compliance donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">PM Compliance</CardTitle>
          </CardHeader>
          <CardContent className="h-52">
            {loadPC ? <Skeleton className="h-full w-full" /> : donutData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground text-sm">
                <CheckCircle2 className="h-8 w-8 text-green-500/60" />
                All PMs current
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" nameKey="name" paddingAngle={2} stroke="none">
                    {donutData.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Vehicle urgency list — spans 2 cols */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Fleet Urgency — Vehicles Needing Attention</CardTitle>
            <Link href="/vehicles" className="text-xs text-primary flex items-center gap-1 hover:underline shrink-0">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {loadU ? (
              <div className="p-4 space-y-2">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (urgencyList as any[]).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm gap-2">
                <ShieldCheck className="h-8 w-8 text-green-500/60" />
                All vehicles on schedule
              </div>
            ) : (
              <ul className="divide-y divide-border/40 max-h-52 overflow-y-auto">
                {(urgencyList as any[]).filter((v: any) => v.urgency !== "ok").slice(0, 20).map((v: any) => (
                  <li key={v.id} className={cn("flex items-center gap-3 px-4 py-2.5 border-l-[3px] hover:bg-muted/20 transition-colors", URGENCY_COLORS[v.urgency as keyof typeof URGENCY_COLORS])}>
                    <UrgencyStrip urgency={v.urgency} />
                    <div className="flex-1 min-w-0">
                      <Link href={`/vehicles/${v.id}`} className="font-semibold text-sm hover:text-primary transition-colors">
                        {v.unitNumber}
                      </Link>
                      <span className="text-xs text-muted-foreground ml-2">{v.make} {v.model}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs shrink-0">
                      <span className={cn("capitalize", {
                        "text-red-400":   v.status === "out_of_service",
                        "text-amber-400": v.status === "restricted" || v.status === "in_repair",
                        "text-green-400": v.status === "available",
                        "text-muted-foreground": v.status === "inactive",
                      })}>{v.status.replace(/_/g, " ")}</span>
                      {v.minDaysUntilDue !== null && (
                        <span className={cn("font-mono font-semibold", {
                          "text-red-400":   v.minDaysUntilDue < 0,
                          "text-amber-400": v.minDaysUntilDue >= 0 && v.minDaysUntilDue <= 30,
                          "text-muted-foreground": v.minDaysUntilDue > 30,
                        })}>
                          {v.minDaysUntilDue < 0 ? `${Math.abs(v.minDaysUntilDue)}d overdue` : `${v.minDaysUntilDue}d`}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
