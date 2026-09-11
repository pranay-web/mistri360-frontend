import { useState } from "react";
import { useLocation } from "wouter";
import {
  useListChecklists,
  type ChecklistListItem,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  CheckCircle2,
  AlertTriangle,
  Clock,
  Lock,
  Search,
  ClipboardCheck,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";

const CHECKLIST_LABELS: Record<string, string> = {
  pm1: "PM1",
  pm2: "PM2",
  trailer: "Trailer",
  reefer: "Reefer",
};

function StatusBadge({ item }: { item: ChecklistListItem }) {
  if (item.isLocked) {
    return (
      <Badge variant="outline" className="gap-1 text-xs border-green-500/40 text-green-400">
        <Lock className="h-3 w-3" /> Submitted
      </Badge>
    );
  }
  if (item.completedCount === item.totalCount && item.totalCount > 0) {
    return (
      <Badge variant="outline" className="gap-1 text-xs border-amber-500/40 text-amber-400">
        <CheckCircle2 className="h-3 w-3" /> Ready to submit
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-xs border-border text-muted-foreground">
      <Clock className="h-3 w-3" /> In progress
    </Badge>
  );
}

export default function ChecklistsPage() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: checklists = [], isLoading } = useListChecklists(
    statusFilter === "locked" ? { locked: true } :
    statusFilter === "open" ? { locked: false } : {}
  );

  const filtered = checklists.filter((cl) => {
    const matchSearch =
      !search ||
      (cl.woNumber ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (cl.vehicleUnitNumber ?? "").toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || cl.checklistType === typeFilter;
    return matchSearch && matchType;
  });

  const totalDefects = filtered.reduce((s, cl) => s + (cl.defectCount ?? 0), 0);
  const submitted = filtered.filter((cl) => cl.isLocked).length;
  const inProgress = filtered.filter((cl) => !cl.isLocked).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Digital Checklists</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          PM1, PM2, trailer and reefer inspection records
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: filtered.length, icon: <ClipboardCheck className="h-4 w-4" /> },
          { label: "Submitted", value: submitted, icon: <Lock className="h-4 w-4 text-green-400" /> },
          { label: "In Progress", value: inProgress, icon: <Clock className="h-4 w-4 text-amber-400" /> },
          { label: "Defects Found", value: totalDefects, icon: <AlertTriangle className="h-4 w-4 text-red-400" /> },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              {card.icon}
              <span className="text-xs">{card.label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search WO # or vehicle..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="pm1">PM1</SelectItem>
            <SelectItem value="pm2">PM2</SelectItem>
            <SelectItem value="trailer">Trailer</SelectItem>
            <SelectItem value="reefer">Reefer</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">In Progress</SelectItem>
            <SelectItem value="locked">Submitted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground animate-pulse">
          Loading checklists…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <ClipboardCheck className="h-10 w-10 opacity-40" />
          <p>No checklists found</p>
          <p className="text-xs">Checklists are created automatically when a PM1, PM2, trailer, or reefer work order is opened.</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Work Order</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Defects</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((cl) => {
                  const progress = cl.totalCount > 0
                    ? Math.round((cl.completedCount / cl.totalCount) * 100)
                    : 0;
                  return (
                    <TableRow
                      key={cl.id}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => setLocation(`/work-orders/${cl.workOrderId}`)}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {cl.woNumber ?? `#${cl.workOrderId}`}
                      </TableCell>
                      <TableCell className="font-medium">{cl.vehicleUnitNumber ?? "—"}</TableCell>
                      <TableCell>
                        <span className="text-xs font-semibold text-primary">
                          {CHECKLIST_LABELS[cl.checklistType] ?? cl.checklistType}
                        </span>
                      </TableCell>
                      <TableCell><StatusBadge item={cl} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${cl.isLocked ? "bg-green-500" : "bg-primary"}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {cl.completedCount}/{cl.totalCount}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {(cl.defectCount ?? 0) > 0 ? (
                          <div className="flex items-center gap-1 text-red-400 text-xs font-semibold">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {cl.defectCount}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {cl.submittedAt ? format(new Date(cl.submittedAt), "MMM d, yyyy") : "—"}
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
