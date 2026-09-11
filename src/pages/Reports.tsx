import { useState, useMemo, useRef } from "react";
import {
  useGetReportMaintenanceHistory,
  useGetReportPmCompliance,
  useGetReportOpenDefects,
  useGetReportOutOfService,
  useGetReportMechanicProductivity,
  useGetReportMaintenanceCost,
  useGetReportRoadsideViolations,
  useGetReportInspectionExpiry,
  useListVehicles,
  useGetMe,
  type VehicleListItem,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import {
  FileText,
  FileSpreadsheet,
  Filter,
  Search,
  Download,
  ChevronUp,
  ChevronDown,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Wrench,
  DollarSign,
  ShieldAlert,
  ShieldCheck,
  Users,
  BarChart3,
} from "lucide-react";
import { format } from "date-fns";

// ── Report definitions ────────────────────────────────────────────────────────

type ReportId =
  | "maintenance-history"
  | "pm-compliance"
  | "open-defects"
  | "out-of-service"
  | "mechanic-productivity"
  | "maintenance-cost"
  | "roadside-violations"
  | "inspection-expiry";

const REPORTS: { id: ReportId; label: string; icon: React.ElementType; roles: string[] }[] = [
  { id: "maintenance-history", label: "Maintenance History", icon: ClipboardList, roles: ["admin", "manager", "mechanic"] },
  { id: "pm-compliance", label: "PM Compliance", icon: CheckCircle2, roles: ["admin", "manager"] },
  { id: "open-defects", label: "Open Defects", icon: AlertTriangle, roles: ["admin", "manager"] },
  { id: "out-of-service", label: "Out-of-Service", icon: XCircle, roles: ["admin", "manager"] },
  { id: "mechanic-productivity", label: "Mechanic Productivity", icon: Users, roles: ["admin"] },
  { id: "maintenance-cost", label: "Maintenance Cost", icon: DollarSign, roles: ["admin", "manager"] },
  { id: "roadside-violations", label: "Roadside Violations", icon: ShieldAlert, roles: ["admin", "manager"] },
  { id: "inspection-expiry", label: "Inspection Expiry", icon: ShieldCheck, roles: ["admin", "manager"] },
];

// ── Shared ReportTable ────────────────────────────────────────────────────────

interface ColDef {
  key: string;
  label: string;
  render?: (val: any, row: any) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

function ReportTable({ columns, data, isLoading }: { columns: ColDef[]; data: any[]; isLoading: boolean }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(q))
    );
  }, [data, search]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (isLoading) return <div className="py-12 text-center text-muted-foreground animate-pulse">Loading report…</div>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search…" className="pl-8 h-8 text-sm" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length.toLocaleString()} row{filtered.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="rounded-lg border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={`text-xs whitespace-nowrap ${col.sortable !== false ? "cursor-pointer select-none hover:text-foreground" : ""} ${col.className ?? ""}`}
                  onClick={() => col.sortable !== false && toggleSort(col.key)}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow><TableCell colSpan={columns.length} className="text-center text-muted-foreground py-12">No data</TableCell></TableRow>
            ) : paged.map((row, i) => (
              <TableRow key={i} className="hover:bg-muted/20">
                {columns.map((col) => (
                  <TableCell key={col.key} className={`text-xs py-2 ${col.className ?? ""}`}>
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? "—")}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
          <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
        </div>
      )}
    </div>
  );
}

// ── Export helpers ────────────────────────────────────────────────────────────

async function triggerDownload(type: ReportId, format: "pdf" | "xlsx", params: Record<string, string>) {
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v))).toString();
  const url = `/api/reports/${type}/${format}${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objUrl;
  a.download = `${type}-report.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objUrl);
}

function ExportButtons({ type, params }: { type: ReportId; params: Record<string, string> }) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [xlsBusy, setXlsBusy] = useState(false);
  const handle = async (format: "pdf" | "xlsx", setB: (v: boolean) => void) => {
    setB(true);
    try { await triggerDownload(type, format, params); }
    catch { /* toast not available here; silently ignore */ }
    finally { setB(false); }
  };
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" className="gap-1.5 text-xs" disabled={pdfBusy} onClick={() => handle("pdf", setPdfBusy)}>
        <FileText className="h-3.5 w-3.5 text-red-400" />{pdfBusy ? "…" : "PDF"}
      </Button>
      <Button size="sm" variant="outline" className="gap-1.5 text-xs" disabled={xlsBusy} onClick={() => handle("xlsx", setXlsBusy)}>
        <FileSpreadsheet className="h-3.5 w-3.5 text-green-400" />{xlsBusy ? "…" : "Excel"}
      </Button>
    </div>
  );
}

// ── Date range filter ─────────────────────────────────────────────────────────

function DateRangeFilter({ from, to, onChange }: { from: string; to: string; onChange: (f: string, t: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs">From</Label>
        <Input type="date" className="h-7 text-xs w-36" value={from} onChange={(e) => onChange(e.target.value, to)} />
      </div>
      <div className="flex items-center gap-1.5">
        <Label className="text-xs">To</Label>
        <Input type="date" className="h-7 text-xs w-36" value={to} onChange={(e) => onChange(from, e.target.value)} />
      </div>
    </div>
  );
}

// ── Vehicle filter ────────────────────────────────────────────────────────────

const ALL_VEHICLES = "all";

function VehicleFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: vehicles = [] } = useListVehicles();
  return (
    <Select value={value || ALL_VEHICLES} onValueChange={(v) => onChange(v === ALL_VEHICLES ? "" : v)}>
      <SelectTrigger className="h-7 w-44 text-xs"><SelectValue placeholder="All vehicles" /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VEHICLES}>All vehicles</SelectItem>
        {(vehicles as VehicleListItem[]).map((v) => (
          <SelectItem key={v.id} value={String(v.id)}>{v.unitNumber}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── Default date range ────────────────────────────────────────────────────────

function defaultRange() {
  const to = new Date().toISOString().split("T")[0];
  const from = new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split("T")[0];
  return { from, to };
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusChip({ value, colorMap }: { value: string; colorMap?: Record<string, string> }) {
  const def = colorMap?.[value] ?? "text-muted-foreground border-border";
  return <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${def}`}>{value.replace(/_/g, " ")}</span>;
}

const SEVERITY_COLORS: Record<string, string> = {
  out_of_service: "text-red-400 border-red-400/40 bg-red-950/20",
  major: "text-orange-400 border-orange-400/40",
  minor: "text-amber-400 border-amber-400/40",
};

const STATUS_COLORS: Record<string, string> = {
  open: "text-blue-400 border-blue-400/40",
  assigned: "text-indigo-400 border-indigo-400/40",
  overdue: "text-red-400 border-red-400/40 bg-red-950/10",
  expired: "text-red-400 border-red-400/40 bg-red-950/20",
  expiring_soon: "text-orange-400 border-orange-400/40",
  valid: "text-green-400 border-green-400/40",
  no_record: "text-muted-foreground border-border",
  due_soon: "text-orange-400 border-orange-400/40",
  ok: "text-green-400 border-green-400/40",
  no_schedule: "text-muted-foreground border-border",
};

function fmtDate(v: any) {
  if (!v) return "—";
  try { return format(new Date(v), "MMM d, yyyy"); } catch { return String(v); }
}

function fmtNum(v: any, decimals = 0) {
  if (v === null || v === undefined) return "—";
  return typeof v === "number" ? v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : String(v);
}

function fmtCurrency(v: any) {
  if (v === null || v === undefined) return "—";
  return `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual report panels
// ─────────────────────────────────────────────────────────────────────────────

function MaintenanceHistoryReport({ role }: { role: string }) {
  const { from, to } = defaultRange();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const [vehicleId, setVehicleId] = useState("");
  const { data = [], isLoading } = useGetReportMaintenanceHistory(
    { from: f, to: t, ...(vehicleId ? { vehicleId: Number(vehicleId) } : {}) },
    { query: { queryKey: ["report-maintenance-history", f, t, vehicleId] } }
  );

  const cols: ColDef[] = [
    { key: "woNumber", label: "WO#", className: "font-mono" },
    { key: "vehicleUnitNumber", label: "Unit" },
    { key: "workOrderType", label: "Type", render: (v) => <StatusChip value={v} /> },
    { key: "status", label: "Status", render: (v) => <StatusChip value={v} /> },
    { key: "mechanicName", label: "Mechanic" },
    { key: "odometerAtService", label: "Odometer", render: (v) => fmtNum(v) },
    { key: "totalLabourHours", label: "Labour h", render: (v) => fmtNum(v, 1) },
    { key: "totalPartsCost", label: "Parts $", render: (v) => fmtCurrency(v) },
    { key: "completedAt", label: "Completed", render: fmtDate },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3 items-center">
        <DateRangeFilter from={f} to={t} onChange={(nf, nt) => { setF(nf); setT(nt); }} />
        <VehicleFilter value={vehicleId} onChange={setVehicleId} />
        <div className="ml-auto"><ExportButtons type="maintenance-history" params={{ from: f, to: t, vehicleId }} /></div>
      </div>
      <ReportTable columns={cols} data={data as any[]} isLoading={isLoading} />
    </div>
  );
}

function PmComplianceReport() {
  const { data, isLoading } = useGetReportPmCompliance(undefined, { query: { queryKey: ["report-pm-compliance"] } });
  const rows = (data as any)?.rows ?? [];
  const summary = (data as any)?.summary;

  const cols: ColDef[] = [
    { key: "unitNumber", label: "Unit" },
    { key: "make", label: "Make" },
    { key: "model", label: "Model" },
    { key: "type", label: "Type" },
    { key: "currentOdometer", label: "Odometer", render: (v) => fmtNum(v) },
    { key: "pm1DueDate", label: "PM1 Due", render: fmtDate },
    { key: "pm1Status", label: "PM1 Status", render: (v) => <StatusChip value={v} colorMap={STATUS_COLORS} /> },
    { key: "pm1DaysUntilDue", label: "PM1 Days", render: (v) => v !== null ? (v < 0 ? <span className="text-red-400 font-bold">{v}d</span> : `${v}d`) : "—" },
    { key: "pm2DueDate", label: "PM2 Due", render: fmtDate },
    { key: "pm2Status", label: "PM2 Status", render: (v) => <StatusChip value={v} colorMap={STATUS_COLORS} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Vehicles", value: summary.total },
            { label: "PM1 Overdue", value: summary.pm1Overdue, danger: summary.pm1Overdue > 0 },
            { label: "PM2 Overdue", value: summary.pm2Overdue, danger: summary.pm2Overdue > 0 },
            { label: "Compliance Rate", value: `${summary.complianceRate}%`, ok: summary.complianceRate >= 90 },
          ].map(({ label, value, danger, ok }: any) => (
            <div key={label} className="rounded-lg border border-border bg-card/50 p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`text-xl font-bold font-mono mt-0.5 ${danger ? "text-red-400" : ok ? "text-green-400" : ""}`}>{value}</p>
            </div>
          ))}
        </div>
      )}
      <div className="ml-auto"><ExportButtons type="pm-compliance" params={{}} /></div>
      <ReportTable columns={cols} data={rows} isLoading={isLoading} />
    </div>
  );
}

function OpenDefectsReport() {
  const [vehicleId, setVehicleId] = useState("");
  const { data = [], isLoading } = useGetReportOpenDefects(
    vehicleId ? { vehicleId: Number(vehicleId) } : undefined,
    { query: { queryKey: ["report-open-defects", vehicleId] } }
  );

  const cols: ColDef[] = [
    { key: "id", label: "DEF#", render: (v) => <span className="font-mono text-[10px]">DEF-{String(v).padStart(4,"0")}</span> },
    { key: "vehicleUnitNumber", label: "Unit" },
    { key: "severity", label: "Severity", render: (v) => <StatusChip value={v} colorMap={SEVERITY_COLORS} /> },
    { key: "status", label: "Status", render: (v) => <StatusChip value={v} colorMap={STATUS_COLORS} /> },
    { key: "source", label: "Source", render: (v) => v?.replace(/_/g," ") },
    { key: "description", label: "Description", className: "max-w-[200px] truncate" },
    { key: "reportedByName", label: "Reported By" },
    { key: "agedays", label: "Age (days)", render: (v) => <span className={v > 7 ? "text-orange-400 font-bold" : ""}>{v}d</span> },
    { key: "createdAt", label: "Date", render: fmtDate },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3 items-center">
        <VehicleFilter value={vehicleId} onChange={setVehicleId} />
        <div className="ml-auto"><ExportButtons type="open-defects" params={{ vehicleId }} /></div>
      </div>
      <ReportTable columns={cols} data={data as any[]} isLoading={isLoading} />
    </div>
  );
}

function OutOfServiceReport() {
  const { from, to } = defaultRange();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const { data = [], isLoading } = useGetReportOutOfService(
    { from: f, to: t },
    { query: { queryKey: ["report-oos", f, t] } }
  );

  const cols: ColDef[] = [
    { key: "vehicleUnitNumber", label: "Unit" },
    { key: "vehicleMake", label: "Make" },
    { key: "description", label: "Description", className: "max-w-[200px] truncate" },
    { key: "status", label: "Status", render: (v) => <StatusChip value={v} colorMap={STATUS_COLORS} /> },
    { key: "reportedByName", label: "Reported By" },
    { key: "downtimeDays", label: "Downtime (d)", render: (v) => <span className={Number(v) > 3 ? "text-red-400 font-bold" : ""}>{v}d</span> },
    { key: "resolutionNotes", label: "Resolution", className: "max-w-[160px] truncate" },
    { key: "repairedAt", label: "Repaired", render: fmtDate },
    { key: "createdAt", label: "Reported", render: fmtDate },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3 items-center">
        <DateRangeFilter from={f} to={t} onChange={(nf, nt) => { setF(nf); setT(nt); }} />
        <div className="ml-auto"><ExportButtons type="out-of-service" params={{ from: f, to: t }} /></div>
      </div>
      <ReportTable columns={cols} data={data as any[]} isLoading={isLoading} />
    </div>
  );
}

function MechanicProductivityReport() {
  const { from, to } = defaultRange();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const { data = [], isLoading } = useGetReportMechanicProductivity(
    { from: f, to: t },
    { query: { queryKey: ["report-mechanic-productivity", f, t] } }
  );

  const cols: ColDef[] = [
    { key: "mechanicName", label: "Mechanic" },
    { key: "jobsCompleted", label: "Jobs", render: (v) => <span className="font-bold">{v}</span> },
    { key: "pm1Jobs", label: "PM1" },
    { key: "pm2Jobs", label: "PM2" },
    { key: "breakdownJobs", label: "Breakdowns" },
    { key: "totalLabourHours", label: "Labour h", render: (v) => fmtNum(v, 1) },
    { key: "avgLabourHoursPerJob", label: "Avg h/job", render: (v) => fmtNum(v, 1) },
    { key: "totalPartsCost", label: "Parts $", render: (v) => fmtCurrency(v) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3 items-center">
        <DateRangeFilter from={f} to={t} onChange={(nf, nt) => { setF(nf); setT(nt); }} />
        <div className="ml-auto"><ExportButtons type="mechanic-productivity" params={{ from: f, to: t }} /></div>
      </div>
      <ReportTable columns={cols} data={data as any[]} isLoading={isLoading} />
    </div>
  );
}

function MaintenanceCostReport() {
  const { from, to } = defaultRange();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const [vehicleId, setVehicleId] = useState("");
  const { data = [], isLoading } = useGetReportMaintenanceCost(
    { from: f, to: t, ...(vehicleId ? { vehicleId: Number(vehicleId) } : {}) },
    { query: { queryKey: ["report-maintenance-cost", f, t, vehicleId] } }
  );

  const totalCost = (data as any[]).reduce((acc: number, r: any) => acc + (r.totalCost ?? 0), 0);

  const cols: ColDef[] = [
    { key: "unitNumber", label: "Unit" },
    { key: "make", label: "Make" },
    { key: "workOrderType", label: "Job Type", render: (v) => <StatusChip value={v} /> },
    { key: "jobCount", label: "Jobs" },
    { key: "totalLabourHours", label: "Labour h", render: (v) => fmtNum(v, 1) },
    { key: "totalPartsCost", label: "Parts $", render: (v) => fmtCurrency(v) },
    { key: "estimatedLabourCost", label: "Labour $", render: (v) => fmtCurrency(v) },
    { key: "totalCost", label: "Total $", render: (v) => <span className="font-bold">{fmtCurrency(v)}</span> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3 items-center">
        <DateRangeFilter from={f} to={t} onChange={(nf, nt) => { setF(nf); setT(nt); }} />
        <VehicleFilter value={vehicleId} onChange={setVehicleId} />
        {totalCost > 0 && <span className="text-sm font-semibold ml-2">Period Total: <span className="text-primary">{fmtCurrency(totalCost)}</span></span>}
        <div className="ml-auto"><ExportButtons type="maintenance-cost" params={{ from: f, to: t, vehicleId }} /></div>
      </div>
      <ReportTable columns={cols} data={data as any[]} isLoading={isLoading} />
    </div>
  );
}

function RoadsideViolationsReport() {
  const { from, to } = defaultRange();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const [vehicleId, setVehicleId] = useState("");
  const { data = [], isLoading } = useGetReportRoadsideViolations(
    { from: f, to: t, ...(vehicleId ? { vehicleId: Number(vehicleId) } : {}) },
    { query: { queryKey: ["report-roadside-violations", f, t, vehicleId] } }
  );

  const cols: ColDef[] = [
    { key: "vehicleUnitNumber", label: "Unit" },
    { key: "inspectionDate", label: "Date", render: fmtDate },
    { key: "inspectionLocation", label: "Location" },
    { key: "violationCode", label: "Code", className: "font-mono text-[10px]" },
    { key: "violationDescription", label: "Description", className: "max-w-[200px] truncate" },
    { key: "severity", label: "Severity", render: (v) => <StatusChip value={v} colorMap={SEVERITY_COLORS} /> },
    { key: "correctiveAction", label: "Action", className: "max-w-[150px] truncate" },
    { key: "resolved", label: "Resolved", render: (v) => v ? <span className="text-green-400 text-xs">✓ Yes</span> : <span className="text-orange-400 text-xs">⚠ No</span> },
    { key: "resolvedAt", label: "Resolved At", render: fmtDate },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3 items-center">
        <DateRangeFilter from={f} to={t} onChange={(nf, nt) => { setF(nf); setT(nt); }} />
        <VehicleFilter value={vehicleId} onChange={setVehicleId} />
        <div className="ml-auto"><ExportButtons type="roadside-violations" params={{ from: f, to: t, vehicleId }} /></div>
      </div>
      <ReportTable columns={cols} data={data as any[]} isLoading={isLoading} />
    </div>
  );
}

function InspectionExpiryReport() {
  const { data = [], isLoading } = useGetReportInspectionExpiry({ query: { queryKey: ["report-inspection-expiry"] } });

  const cols: ColDef[] = [
    { key: "unitNumber", label: "Unit" },
    { key: "make", label: "Make" },
    { key: "model", label: "Model" },
    { key: "vehicleStatus", label: "Vehicle Status", render: (v) => <StatusChip value={v} /> },
    { key: "pmcviExpiryDate", label: "PMCVI Expires", render: fmtDate },
    { key: "pmcviDaysRemaining", label: "PMCVI Days", render: (v) => v !== null ? (v < 0 ? <span className="text-red-400 font-bold">{v}d</span> : `${v}d`) : "—" },
    { key: "pmcviStatus", label: "PMCVI", render: (v) => <StatusChip value={v} colorMap={STATUS_COLORS} /> },
    { key: "pmcviOfficiallyPassed", label: "DriveON", render: (v) => v === true ? <span className="text-green-400 text-xs">✓</span> : v === false ? <span className="text-orange-400 text-xs">⚠</span> : "—" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end"><ExportButtons type="inspection-expiry" params={{}} /></div>
      <ReportTable columns={cols} data={data as any[]} isLoading={isLoading} />
    </div>
  );
}

// ── Main Reports page ─────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { data: currentUser } = useGetMe();
  const role = currentUser?.role ?? "mechanic";
  const [activeReport, setActiveReport] = useState<ReportId>("maintenance-history");

  const effectiveRole = role === "mechanic" ? "admin" : role;
  const visibleReports = REPORTS.filter((r) => r.roles.includes(effectiveRole));

  const ActiveReport = () => {
    switch (activeReport) {
      case "maintenance-history": return <MaintenanceHistoryReport role={role} />;
      case "pm-compliance": return <PmComplianceReport />;
      case "open-defects": return <OpenDefectsReport />;
      case "out-of-service": return <OutOfServiceReport />;
      case "mechanic-productivity": return <MechanicProductivityReport />;
      case "maintenance-cost": return <MaintenanceCostReport />;
      case "roadside-violations": return <RoadsideViolationsReport />;
      case "inspection-expiry": return <InspectionExpiryReport />;
      default: return null;
    }
  };

  const current = REPORTS.find((r) => r.id === activeReport);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Generate, filter, and export fleet reports</p>
      </div>

      <div className="flex gap-6 flex-col md:flex-row">
        {/* Sidebar */}
        <aside className="md:w-52 shrink-0">
          <nav className="flex flex-row md:flex-col flex-wrap gap-1">
            {visibleReports.map((r) => {
              const Icon = r.icon;
              return (
                <button
                  key={r.id}
                  onClick={() => setActiveReport(r.id)}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-left transition-colors w-full
                    ${activeReport === r.id
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"}`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {r.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Report content */}
        <div className="flex-1 min-w-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                {current && <current.icon className="h-4 w-4 text-primary" />}
                {current?.label ?? "Report"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActiveReport />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
