import { useState, useRef } from "react";
import { useLocation } from "wouter";
import {
  useListDefects,
  useCreateDefect,
  useUpdateDefect,
  useGetMe,
  useListVehicles,
  getListDefectsQueryKey,
  type DefectListItem,
  type DefectDetail,
  type VehicleListItem,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Clock,
  Camera,
  Upload,
  Plus,
  Search,
  Truck,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

// ── Severity / Status helpers ─────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  minor: { label: "Minor", color: "text-amber-400 border-amber-400/40 bg-amber-950/20", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  major: { label: "Major", color: "text-orange-400 border-orange-400/40 bg-orange-950/20", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  out_of_service: { label: "Out of Service", color: "text-red-400 border-red-400/40 bg-red-950/20", icon: <XCircle className="h-3.5 w-3.5" /> },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open: { label: "Open", color: "text-blue-400 border-blue-400/40 bg-blue-950/20" },
  assigned: { label: "Assigned", color: "text-indigo-400 border-indigo-400/40 bg-indigo-950/20" },
  repaired: { label: "Repaired", color: "text-green-400 border-green-400/40 bg-green-950/20" },
  deferred: { label: "Deferred", color: "text-yellow-400 border-yellow-400/40 bg-yellow-950/20" },
  restricted: { label: "Restricted", color: "text-orange-400 border-orange-400/40 bg-orange-950/20" },
  out_of_service: { label: "Out of Service", color: "text-red-400 border-red-400/40 bg-red-950/20" },
};

function SeverityBadge({ severity }: { severity: string }) {
  const cfg = SEVERITY_CONFIG[severity] ?? { label: severity, color: "text-gray-400 border-gray-400/40 bg-gray-950/20", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "text-gray-400 border-gray-400/40 bg-gray-950/20" };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// ── Driver Submit Form ────────────────────────────────────────────────────────

function DriverSubmitForm({ onSuccess }: { onSuccess: () => void }) {
  const { data: vehicles = [] } = useListVehicles();
  const createDefect = useCreateDefect();
  const [vehicleId, setVehicleId] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"minor" | "major" | "out_of_service">("minor");
  const [location, setLocation] = useState("");
  const [odometer, setOdometer] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [submitted, setSubmitted] = useState<number | null>(null);

  const handlePhotoUpload = async (file: File) => {
    if (photos.length >= 5) { toast.error("Maximum 5 photos allowed"); return; }
    setIsUploading(true);
    try {
      const urlRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "image/jpeg" }),
        credentials: "include",
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();
      await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type || "image/jpeg" } });
      setPhotos((prev) => [...prev, objectPath]);
      toast.success("Photo added");
    } catch {
      toast.error("Photo upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = () => {
    if (!vehicleId || !description.trim()) {
      toast.error("Please select a vehicle and describe the defect");
      return;
    }
    createDefect.mutate(
      { data: { vehicleId: Number(vehicleId), description, severity, location: location || undefined, odometerAtReport: odometer ? Number(odometer) : undefined, photoFileKeys: photos } },
      {
        onSuccess: (defect) => { setSubmitted(defect.id); onSuccess(); },
        onError: (err) => toast.error((err as any)?.response?.data?.error ?? "Failed to submit defect"),
      }
    );
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-6 py-12 text-center">
        <CheckCircle2 className="h-16 w-16 text-green-400" />
        <div>
          <h2 className="text-2xl font-bold text-foreground">Defect Reported</h2>
          <p className="text-muted-foreground mt-2">Reference number: <span className="font-mono font-bold text-primary">DEF-{String(submitted).padStart(4, "0")}</span></p>
          <p className="text-sm text-muted-foreground mt-1">A manager has been notified. Check back for updates.</p>
        </div>
        <Button onClick={() => { setSubmitted(null); setVehicleId(""); setDescription(""); setSeverity("minor"); setLocation(""); setOdometer(""); setPhotos([]); }}>
          Report Another Defect
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-lg mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Report a Defect</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Use this form to report any vehicle issue before or after your trip.</p>
      </div>

      {/* Vehicle */}
      <div>
        <Label className="text-base font-semibold mb-2 block">Which vehicle?</Label>
        <Select value={vehicleId} onValueChange={setVehicleId}>
          <SelectTrigger className="h-12 text-base">
            <SelectValue placeholder="Select your vehicle..." />
          </SelectTrigger>
          <SelectContent>
            {(vehicles as VehicleListItem[]).map((v) => (
              <SelectItem key={v.id} value={String(v.id)}>
                {v.unitNumber} — {v.year} {v.make} {v.model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Severity */}
      <div>
        <Label className="text-base font-semibold mb-2 block">How serious?</Label>
        <div className="grid grid-cols-3 gap-2">
          {(["minor", "major", "out_of_service"] as const).map((s) => {
            const cfg = SEVERITY_CONFIG[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSeverity(s)}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all active:scale-95
                  ${severity === s ? `border-current ${cfg.color}` : "border-border bg-card text-muted-foreground hover:border-border/80"}`}
              >
                <span className="text-xl">{s === "minor" ? "⚠️" : s === "major" ? "🔴" : "🚫"}</span>
                <span className="text-xs font-bold leading-tight text-center">{cfg.label}</span>
              </button>
            );
          })}
        </div>
        {severity === "out_of_service" && (
          <p className="text-xs text-red-400 mt-2 font-medium">⚠ Out of Service will immediately alert the maintenance team. Do not drive this vehicle.</p>
        )}
      </div>

      {/* Description */}
      <div>
        <Label className="text-base font-semibold mb-2 block">What's wrong?</Label>
        <Textarea
          placeholder="Describe the issue clearly — what you saw, heard, or felt..."
          rows={4}
          className="text-base resize-none"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {/* Location */}
      <div>
        <Label className="text-base font-semibold mb-2 block">Where are you? <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Input className="h-12 text-base" placeholder="e.g. Highway 401 rest stop, Toronto yard..." value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>

      {/* Odometer */}
      <div>
        <Label className="text-base font-semibold mb-2 block">Odometer reading <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Input className="h-12 text-base font-mono" type="number" placeholder="km" value={odometer} onChange={(e) => setOdometer(e.target.value)} />
      </div>

      {/* Photos */}
      <div>
        <Label className="text-base font-semibold mb-2 block">Photos <span className="font-normal text-muted-foreground">(up to 5)</span></Label>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); e.target.value = ""; }} />
        <div className="flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <div key={i} className="relative rounded-lg border border-border bg-muted w-20 h-20 flex items-center justify-center">
              <Camera className="h-6 w-6 text-muted-foreground" />
              <button onClick={() => setPhotos(photos.filter((_, j) => j !== i))} className="absolute -top-2 -right-2 rounded-full bg-red-600 text-white w-5 h-5 text-xs flex items-center justify-center">×</button>
            </div>
          ))}
          {photos.length < 5 && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={isUploading}
              className="rounded-lg border-2 border-dashed border-border bg-card w-20 h-20 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/40 transition-colors"
            >
              {isUploading ? <Upload className="h-5 w-5 animate-bounce" /> : <Camera className="h-5 w-5" />}
              <span className="text-xs">{isUploading ? "Uploading…" : "Add photo"}</span>
            </button>
          )}
        </div>
      </div>

      <Button
        size="lg"
        className="h-14 text-base font-bold mt-2"
        disabled={!vehicleId || !description.trim() || createDefect.isPending}
        onClick={handleSubmit}
      >
        {createDefect.isPending ? "Submitting…" : "Submit Defect Report"}
      </Button>
    </div>
  );
}

// ── Manager Defect Detail Modal ───────────────────────────────────────────────

function DefectDetailModal({ defect, open, onClose, onUpdate }: { defect: DefectListItem | null; open: boolean; onClose: () => void; onUpdate: () => void }) {
  const updateDefect = useUpdateDefect();
  const [newStatus, setNewStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [, navigate] = useLocation();

  if (!defect) return null;

  const handleUpdate = () => {
    if (!newStatus) return;
    updateDefect.mutate(
      { id: defect.id, data: { status: newStatus as any, resolutionNotes: notes || undefined } },
      {
        onSuccess: (result: any) => {
          const autoWo = result?.autoCreatedWo;
          if (autoWo) {
            toast.success(`Work order ${autoWo.woNumber} created and linked`, {
              description: "The defect has been assigned and a work order opened for the mechanic.",
              action: {
                label: "View Work Order",
                onClick: () => { onClose(); navigate(`/work-orders/${autoWo.id}`); },
              },
              duration: 8000,
            });
          } else {
            toast.success("Defect updated");
          }
          onUpdate();
          onClose();
          setNewStatus("");
          setNotes("");
        },
        onError: (err: any) => toast.error(err?.response?.data?.error ?? "Update failed"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SeverityBadge severity={defect.severity} />
            Defect DEF-{String(defect.id).padStart(4, "0")}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: "Vehicle", value: defect.vehicleUnitNumber ?? "—" },
              { label: "Reported By", value: defect.reportedByName ?? "—" },
              { label: "Status", value: <StatusBadge status={defect.status} /> },
              { label: "Source", value: defect.source.replace("_", " ") },
              { label: "Location", value: defect.location ?? "—" },
              { label: "Odometer", value: defect.odometerAtReport ? `${defect.odometerAtReport.toLocaleString()} km` : "—" },
              { label: "Reported", value: format(new Date(defect.createdAt), "MMM d, yyyy h:mm a") },
              { label: "Photos", value: (defect.photoCount ?? 0) > 0 ? `${defect.photoCount} photo(s)` : "None" },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <div className="font-medium mt-0.5">{value}</div>
              </div>
            ))}
          </div>

          {/* Linked work order banner */}
          {defect.woNumber && (
            <button
              type="button"
              onClick={() => { onClose(); navigate(`/work-orders/${defect.workOrderId}`); }}
              className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm hover:bg-primary/20 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-primary">Work Order Linked</span>
                <span className="font-mono text-xs text-muted-foreground">{defect.woNumber}</span>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-primary" />
            </button>
          )}

          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground mb-1">Description</p>
            <p className="text-sm text-foreground">{defect.description}</p>
          </div>

          {defect.resolutionNotes && (
            <div className="rounded-lg border border-green-500/20 bg-green-950/20 p-3">
              <p className="text-xs text-muted-foreground mb-1">Resolution Notes</p>
              <p className="text-sm text-foreground">{defect.resolutionNotes}</p>
            </div>
          )}

          {defect.status !== "repaired" && (
            <div className="rounded-lg border border-border p-3 flex flex-col gap-3">
              <div>
                <p className="text-sm font-semibold">Update Status</p>
                {newStatus === "assigned" && !defect.workOrderId && (
                  <p className="text-xs text-amber-400 mt-1">⚡ Setting to Assigned will automatically create a linked work order for the mechanic.</p>
                )}
              </div>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new status..." />
                </SelectTrigger>
                <SelectContent>
                  {["open", "assigned", "repaired", "deferred", "restricted", "out_of_service"].map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea placeholder="Resolution notes (optional)..." rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="resize-none" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {defect.status !== "repaired" && (
            <Button onClick={handleUpdate} disabled={!newStatus || updateDefect.isPending}>
              {updateDefect.isPending ? "Updating…" : newStatus === "assigned" && !defect.workOrderId ? "Assign & Create Work Order" : "Update"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DefectsPage() {
  const qc = useQueryClient();
  const { data: currentUser } = useGetMe();
  const isDriver = currentUser?.role === "driver";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [selected, setSelected] = useState<DefectListItem | null>(null);

  const queryParams: Record<string, any> = {};
  if (statusFilter !== "all") queryParams.status = statusFilter;
  if (severityFilter !== "all") queryParams.severity = severityFilter;

  const { data: defects = [], isLoading } = useListDefects(queryParams);

  const refresh = () => qc.invalidateQueries({ queryKey: getListDefectsQueryKey() });

  const filtered = (defects as DefectListItem[]).filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.description.toLowerCase().includes(q) ||
      (d.vehicleUnitNumber ?? "").toLowerCase().includes(q) ||
      (d.reportedByName ?? "").toLowerCase().includes(q) ||
      `DEF-${String(d.id).padStart(4, "0")}`.toLowerCase().includes(q)
    );
  });

  const openCount = (defects as DefectListItem[]).filter((d) => d.status === "open").length;
  const oosCount = (defects as DefectListItem[]).filter((d) => d.severity === "out_of_service").length;

  // Drivers see the submit form
  if (isDriver) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <DriverSubmitForm onSuccess={refresh} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Driver Defects</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Review and manage vehicle defect reports</p>
      </div>

      {/* Alert banner for OOS vehicles */}
      {oosCount > 0 && (
        <div className="rounded-lg border border-red-600/40 bg-red-950/20 p-3 flex items-center gap-3">
          <XCircle className="h-5 w-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300 font-medium">
            {oosCount} Out-of-Service defect{oosCount !== 1 ? "s" : ""} require immediate attention
          </p>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: defects.length, icon: <Truck className="h-4 w-4" /> },
          { label: "Open", value: openCount, icon: <Clock className="h-4 w-4 text-blue-400" /> },
          { label: "Out of Service", value: oosCount, icon: <XCircle className="h-4 w-4 text-red-400" /> },
          { label: "Repaired", value: (defects as DefectListItem[]).filter((d) => d.status === "repaired").length, icon: <CheckCircle2 className="h-4 w-4 text-green-400" /> },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">{card.icon}<span className="text-xs">{card.label}</span></div>
            <p className="text-2xl font-bold text-foreground">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search defects..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Severities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="minor">Minor</SelectItem>
            <SelectItem value="major">Major</SelectItem>
            <SelectItem value="out_of_service">Out of Service</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground animate-pulse">Loading defects…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <CheckCircle2 className="h-10 w-10 opacity-40" />
          <p>No defects found</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                  <TableHead className="hidden md:table-cell">Reported By</TableHead>
                  <TableHead className="hidden lg:table-cell">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => (
                  <TableRow key={d.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelected(d)}>
                    <TableCell className="font-mono text-xs text-muted-foreground">DEF-{String(d.id).padStart(4, "0")}</TableCell>
                    <TableCell className="font-medium">{d.vehicleUnitNumber ?? "—"}</TableCell>
                    <TableCell><SeverityBadge severity={d.severity} /></TableCell>
                    <TableCell><StatusBadge status={d.status} /></TableCell>
                    <TableCell className="hidden md:table-cell max-w-[220px] truncate text-sm text-muted-foreground">{d.description}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{d.reportedByName ?? "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{format(new Date(d.createdAt), "MMM d, yyyy")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <DefectDetailModal defect={selected} open={!!selected} onClose={() => setSelected(null)} onUpdate={refresh} />
    </div>
  );
}
