import { useState } from "react";
import { useLocation } from "wouter";
import {
  useListWorkOrders,
  useGetWorkOrderAlerts,
  type WorkOrderListItem,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
import {
  Plus,
  LayoutGrid,
  List,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Search,
  Package,
} from "lucide-react";
import { format } from "date-fns";

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  draft: { label: "Draft", color: "text-slate-700", bgColor: "bg-slate-100" },
  assigned: { label: "Assigned", color: "text-blue-700", bgColor: "bg-blue-50" },
  checked_in: { label: "Checked In", color: "text-sky-700", bgColor: "bg-sky-50" },
  inspection_in_progress: { label: "Inspection", color: "text-indigo-700", bgColor: "bg-indigo-50" },
  approval_required: { label: "Approval Req.", color: "text-amber-800", bgColor: "bg-amber-50" },
  repair_in_progress: { label: "Repair In Progress", color: "text-orange-800", bgColor: "bg-orange-50" },
  waiting_for_part: { label: "Waiting for Part", color: "text-yellow-800", bgColor: "bg-yellow-50" },
  qc_review: { label: "QC Review", color: "text-purple-700", bgColor: "bg-purple-50" },
  completed: { label: "Completed", color: "text-emerald-700", bgColor: "bg-emerald-50" },
  released: { label: "Released", color: "text-emerald-800", bgColor: "bg-emerald-100" },
  restricted: { label: "Restricted", color: "text-red-700", bgColor: "bg-red-50" },
  out_of_service: { label: "Out of Service", color: "text-red-800", bgColor: "bg-red-100" },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "text-gray-400" },
  normal: { label: "Normal", color: "text-blue-400" },
  high: { label: "High", color: "text-amber-400" },
  critical: { label: "Critical", color: "text-red-400" },
};

const KANBAN_COLUMNS = [
  { id: "queue", label: "In Queue", statuses: ["draft", "assigned"] },
  { id: "active", label: "Active", statuses: ["checked_in", "inspection_in_progress", "approval_required", "repair_in_progress"] },
  { id: "waiting", label: "Waiting / Review", statuses: ["waiting_for_part", "qc_review"] },
  { id: "done", label: "Done", statuses: ["completed", "released"] },
  { id: "oos", label: "OOS / Restricted", statuses: ["restricted", "out_of_service"] },
];

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "text-gray-400", bgColor: "bg-gray-500/20" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bgColor} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY_CONFIG[priority] ?? { label: priority, color: "text-gray-400" };
  return <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label.toUpperCase()}</span>;
}

function WoCard({ wo, onClick }: { wo: WorkOrderListItem; onClick: () => void }) {
  const isOverdue =
    wo.scheduledDate && new Date(wo.scheduledDate) < new Date() &&
    !["completed", "released"].includes(wo.status);

  return (
    <div
      onClick={onClick}
      className={`group cursor-pointer rounded-lg border p-3 bg-card hover:border-primary transition-all ${isOverdue ? "border-red-600/60" : "border-border"}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-mono text-muted-foreground">{wo.woNumber}</span>
        <PriorityBadge priority={wo.priority} />
      </div>
      <p className="text-sm font-semibold text-foreground mb-1 truncate">
        {wo.vehicleUnitNumber ?? "—"} · {wo.workOrderType?.replace(/_/g, " ")}
      </p>
      {wo.customerName && <p className="text-xs text-muted-foreground truncate mb-1">{wo.customerName}</p>}
      {wo.description && (
        <p className="text-xs text-muted-foreground truncate mb-2">{wo.description}</p>
      )}
      <div className="flex items-center justify-between mt-2">
        <StatusBadge status={wo.status} />
        {wo.assignedMechanicName && (
          <span className="text-xs text-muted-foreground truncate max-w-[100px]">
            {wo.assignedMechanicName}
          </span>
        )}
      </div>
      {isOverdue && (
        <div className="mt-2 flex items-center gap-1 text-red-400 text-xs">
          <AlertTriangle className="h-3 w-3" />
          Overdue
        </div>
      )}
      {wo.scheduledDate && !isOverdue && (
        <p className="text-xs text-muted-foreground mt-1">
          Scheduled {format(new Date(wo.scheduledDate), "MMM d")}
        </p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WorkOrdersPage() {
  const [, setLocation] = useLocation();
  const [view, setView] = useState<"kanban" | "table">("table");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const { data: workOrders = [], isLoading } = useListWorkOrders();
  const { data: alerts } = useGetWorkOrderAlerts();

  const filtered = workOrders.filter((wo) => {
    const matchSearch =
      !search ||
      wo.woNumber.toLowerCase().includes(search.toLowerCase()) ||
      (wo.vehicleUnitNumber ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (wo.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (wo.assignedMechanicName ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || wo.status === statusFilter;
    const matchPriority = priorityFilter === "all" || wo.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Work Orders</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {workOrders.length} total work orders
          </p>
        </div>
        <Button onClick={() => setLocation("/work-orders/new")} className="gap-2">
          <Plus className="h-4 w-4" />
          New Work Order
        </Button>
      </div>

      {/* Alert banners */}
      {((alerts?.pendingApprovals ?? 0) > 0 || (alerts?.pendingQcReviews ?? 0) > 0 || (alerts?.waitingForParts ?? 0) > 0) && (
        <div className="flex flex-wrap gap-3">
          {(alerts?.pendingApprovals ?? 0) > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span><strong>{alerts!.pendingApprovals}</strong> work order{alerts!.pendingApprovals !== 1 ? "s" : ""} awaiting approval</span>
            </div>
          )}
          {(alerts?.pendingQcReviews ?? 0) > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-sm text-purple-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span><strong>{alerts!.pendingQcReviews}</strong> work order{alerts!.pendingQcReviews !== 1 ? "s" : ""} in QC review</span>
            </div>
          )}
          {(alerts?.waitingForParts ?? 0) > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-400">
              <Package className="h-4 w-4 shrink-0" />
              <span><strong>{alerts!.waitingForParts}</strong> work order{alerts!.waitingForParts !== 1 ? "s" : ""} waiting for parts</span>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search WO #, vehicle, description..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All Priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant={view === "kanban" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setView("kanban")}
            title="Kanban view"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={view === "table" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setView("table")}
            title="Table view"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground animate-pulse">
          Loading work orders...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Clock className="h-10 w-10 opacity-40" />
          <p>No work orders found</p>
          <Button variant="outline" onClick={() => setLocation("/work-orders/new")}>
            Create your first work order
          </Button>
        </div>
      ) : view === "kanban" ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {KANBAN_COLUMNS.map((col) => {
            const cards = filtered.filter((wo) => col.statuses.includes(wo.status));
            return (
              <div key={col.id} className="flex-shrink-0 w-72">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
                  <Badge variant="secondary" className="text-xs">{cards.length}</Badge>
                </div>
                <div className="flex flex-col gap-2 min-h-[80px]">
                  {cards.map((wo) => (
                    <WoCard
                      key={wo.id}
                      wo={wo}
                      onClick={() => setLocation(`/work-orders/${wo.id}`)}
                    />
                  ))}
                  {cards.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                      No items
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>WO #</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Mechanic</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Parts Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((wo) => {
                  const isOverdue =
                    wo.scheduledDate && new Date(wo.scheduledDate) < new Date() &&
                    !["completed", "released"].includes(wo.status);
                  return (
                    <TableRow
                      key={wo.id}
                      className={`cursor-pointer hover:bg-muted/30 ${isOverdue ? "border-l-2 border-l-red-500" : ""}`}
                      onClick={() => setLocation(`/work-orders/${wo.id}`)}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {wo.woNumber}
                        {isOverdue && <AlertTriangle className="inline ml-1 h-3 w-3 text-red-400" />}
                      </TableCell>
                      <TableCell className="font-medium">{wo.vehicleUnitNumber ?? "—"}</TableCell>
                      <TableCell className="text-sm">{wo.customerName ?? "Internal"}</TableCell>
                      <TableCell className="capitalize text-xs">{wo.workOrderType?.replace(/_/g, " ")}</TableCell>
                      <TableCell><StatusBadge status={wo.status} /></TableCell>
                      <TableCell><PriorityBadge priority={wo.priority} /></TableCell>
                      <TableCell className="text-sm">{wo.assignedMechanicName ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {wo.scheduledDate ? format(new Date(wo.scheduledDate), "MMM d, yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {wo.totalPartsCost ? `$${parseFloat(wo.totalPartsCost).toFixed(2)}` : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
