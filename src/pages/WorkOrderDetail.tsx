import { useState, useRef } from "react";
import { useLocation } from "wouter";
import {
  useGetWorkOrder,
  useGetMe,
  useTransitionWorkOrderStatus,
  useUpdateWorkOrder,
  useAddWorkOrderPart,
  useDeleteWorkOrderPart,
  useAddWorkOrderPhoto,
  useSaveWorkOrderSignature,
  useAddWorkOrderComment,
  useAddWorkOrderLabour,
  useDeleteWorkOrderLabour,
  useAddWorkOrderInvoice,
  useDeleteWorkOrderPhoto,
  getGetWorkOrderQueryKey,
  type WorkOrderDetail,
  type WorkOrderStatusInput,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { SignaturePad } from "@/components/ui/signature-pad";
import WorkOrderChecklist from "@/pages/WorkOrderChecklist";
import {
  ArrowLeft,
  FileDown,
  AlertTriangle,
  Wrench,
  Camera,
  PenLine,
  MessageSquare,
  Clock,
  Trash2,
  Plus,
  Package,
  Receipt,
  Upload,
  ClipboardCheck,
  Pencil,
  Check,
  CheckCircle2,
  Send,
  Play,
  RotateCcw,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  draft: { label: "Draft", color: "text-slate-700", bgColor: "bg-slate-100" },
  assigned: { label: "Assigned", color: "text-blue-700", bgColor: "bg-blue-50" },
  checked_in: { label: "Checked In", color: "text-sky-700", bgColor: "bg-sky-50" },
  inspection_in_progress: { label: "Inspection In Progress", color: "text-indigo-700", bgColor: "bg-indigo-50" },
  approval_required: { label: "Approval Required", color: "text-amber-800", bgColor: "bg-amber-50" },
  repair_in_progress: { label: "Repair In Progress", color: "text-orange-800", bgColor: "bg-orange-50" },
  waiting_for_part: { label: "Waiting for Part", color: "text-yellow-800", bgColor: "bg-yellow-50" },
  qc_review: { label: "QC Review", color: "text-purple-700", bgColor: "bg-purple-50" },
  completed: { label: "Completed", color: "text-emerald-700", bgColor: "bg-emerald-50" },
  released: { label: "Released to Service", color: "text-emerald-800", bgColor: "bg-emerald-100" },
  restricted: { label: "Restricted", color: "text-red-700", bgColor: "bg-red-50" },
  out_of_service: { label: "Out of Service", color: "text-red-800", bgColor: "bg-red-100" },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-gray-400",
  normal: "text-blue-400",
  high: "text-amber-400",
  critical: "text-red-400",
};

// Role-aware transitions — mirrors the backend TRANSITIONS state machine exactly.
// Each entry is [targetStatus, rolesAllowed[]]
type WORole = "admin" | "manager" | "mechanic" | "driver";
const ROLE_TRANSITIONS: Record<string, Array<{ to: string; roles: WORole[] }>> = {
  draft:                   [{ to: "assigned",               roles: ["admin", "manager"] },
                            { to: "repair_in_progress",     roles: ["admin", "manager"] }],
  assigned:                [{ to: "draft",                  roles: ["admin", "manager"] },
                            { to: "checked_in",             roles: ["admin", "manager", "mechanic"] }],
  checked_in:              [{ to: "inspection_in_progress", roles: ["admin", "manager", "mechanic"] },
                            { to: "assigned",               roles: ["admin", "manager"] }],
  inspection_in_progress:  [{ to: "approval_required",      roles: ["admin", "manager", "mechanic"] },
                            { to: "repair_in_progress",     roles: ["admin", "manager", "mechanic"] },
                            { to: "qc_review",              roles: ["admin", "manager", "mechanic"] }],
  approval_required:       [{ to: "repair_in_progress",     roles: ["admin", "manager"] },
                            { to: "draft",                  roles: ["admin", "manager"] }],
  repair_in_progress:      [{ to: "waiting_for_part",       roles: ["admin", "manager", "mechanic"] },
                            { to: "qc_review",              roles: ["admin", "manager", "mechanic"] },
                            { to: "inspection_in_progress", roles: ["admin", "manager", "mechanic"] }],
  waiting_for_part:        [{ to: "repair_in_progress",     roles: ["admin", "manager", "mechanic"] }],
  qc_review:               [{ to: "completed",              roles: ["admin", "manager"] },
                            { to: "repair_in_progress",     roles: ["admin", "manager", "mechanic"] }],
  completed:               [{ to: "released",               roles: ["admin", "manager"] }],
  released:                [{ to: "restricted",             roles: ["admin", "manager"] },
                            { to: "out_of_service",         roles: ["admin", "manager"] }],
  restricted:              [{ to: "released",               roles: ["admin", "manager"] }],
  out_of_service:          [{ to: "released",               roles: ["admin", "manager"] }],
};

function getAvailableTransitions(status: string, role: string): string[] {
  const entries = ROLE_TRANSITIONS[status] ?? [];
  return entries
    .filter((t) => t.roles.includes(role as WORole))
    .map((t) => t.to);
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "text-gray-400", bgColor: "bg-gray-500/20" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bgColor} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(new Date(d), "MMM d, yyyy"); } catch { return d; }
}
function fmtDt(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(new Date(d), "MMM d, yyyy h:mm a"); } catch { return d; }
}

// ── Status Transition Dialog ──────────────────────────────────────────────────

function TransitionDialog({
  wo,
  open,
  onClose,
  onSuccess,
  userRole,
}: {
  wo: WorkOrderDetail;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userRole: string;
}) {
  const [targetStatus, setTargetStatus] = useState("");
  const [notes, setNotes] = useState("");
  const transition = useTransitionWorkOrderStatus();

  const nextStatuses = getAvailableTransitions(wo.status, userRole);

  const handleSubmit = () => {
    if (!targetStatus) return;
    transition.mutate(
      { id: wo.id, data: { status: targetStatus as WorkOrderStatusInput["status"], notes: notes || undefined } },
      {
        onSuccess: () => {
          toast.success("Status updated");
          onSuccess();
          onClose();
          setTargetStatus("");
          setNotes("");
        },
        onError: (err) => toast.error((err as any)?.response?.data?.error ?? "Transition failed"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update work order status</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <Label>Current Status</Label>
            <p className="mt-1"><StatusBadge status={wo.status} /></p>
          </div>
          <div>
            <Label>Transition To</Label>
            <Select value={targetStatus} onValueChange={setTargetStatus}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select new status" />
              </SelectTrigger>
              <SelectContent>
                {nextStatuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_CONFIG[s]?.label ?? s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              className="mt-1"
              placeholder="Reason for transition..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!targetStatus || transition.isPending}>
            {transition.isPending ? "Updating..." : "Update Status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Add Part Dialog ───────────────────────────────────────────────────────────

function AddPartDialog({
  woId,
  open,
  onClose,
  onSuccess,
}: {
  woId: number;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({ vendorName: "", partDescription: "", partNumber: "", invoiceNumber: "", quantity: "1", unitCost: "" });
  const addPart = useAddWorkOrderPart();

  const handleSubmit = () => {
    if (!form.vendorName || !form.partDescription || !form.unitCost) {
      toast.error("Vendor, description, and cost are required");
      return;
    }
    addPart.mutate(
      { id: woId, data: form },
      {
        onSuccess: () => { toast.success("Part added"); onSuccess(); onClose(); setForm({ vendorName: "", partDescription: "", partNumber: "", invoiceNumber: "", quantity: "1", unitCost: "" }); },
        onError: (err) => toast.error((err as any)?.response?.data?.error ?? "Failed to add part"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Part</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Vendor Name *</Label>
            <Input className="mt-1" value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} placeholder="e.g. FleetPro Supply" />
          </div>
          <div className="col-span-2">
            <Label>Part Description *</Label>
            <Input className="mt-1" value={form.partDescription} onChange={(e) => setForm({ ...form, partDescription: e.target.value })} placeholder="e.g. Oil Filter" />
          </div>
          <div>
            <Label>Part Number</Label>
            <Input className="mt-1" value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} placeholder="Optional" />
          </div>
          <div>
            <Label>Invoice Number</Label>
            <Input className="mt-1" value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} placeholder="Optional" />
          </div>
          <div>
            <Label>Quantity</Label>
            <Input className="mt-1" type="number" min="0.01" step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <div>
            <Label>Unit Cost ($) *</Label>
            <Input className="mt-1" type="number" min="0" step="0.01" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} placeholder="0.00" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={addPart.isPending}>
            {addPart.isPending ? "Adding..." : "Add Part"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Add Labour Dialog ─────────────────────────────────────────────────────────

function AddLabourDialog({
  woId,
  open,
  onClose,
  onSuccess,
}: {
  woId: number;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const today = new Date().toISOString().slice(0, 16);
  const [form, setForm] = useState({ startTime: today, endTime: "", hoursWorked: "", labourType: "regular", notes: "" });
  const addLabour = useAddWorkOrderLabour();

  const handleSubmit = () => {
    if (!form.hoursWorked) { toast.error("Hours worked is required"); return; }
    addLabour.mutate(
      { id: woId, data: { startTime: form.startTime, endTime: form.endTime || undefined, hoursWorked: form.hoursWorked, labourType: form.labourType as "regular" | "overtime", notes: form.notes || undefined } },
      {
        onSuccess: () => { toast.success("Labour entry added"); onSuccess(); onClose(); },
        onError: (err) => toast.error((err as any)?.response?.data?.error ?? "Failed"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Log Labour Hours</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Start Time *</Label>
            <Input className="mt-1" type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          </div>
          <div>
            <Label>End Time</Label>
            <Input className="mt-1" type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          </div>
          <div>
            <Label>Hours Worked *</Label>
            <Input className="mt-1" type="number" min="0" step="0.25" value={form.hoursWorked} onChange={(e) => setForm({ ...form, hoursWorked: e.target.value })} placeholder="e.g. 2.5" />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={form.labourType} onValueChange={(v) => setForm({ ...form, labourType: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="regular">Regular</SelectItem>
                <SelectItem value="overtime">Overtime</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Notes</Label>
            <Input className="mt-1" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={addLabour.isPending}>
            {addLabour.isPending ? "Saving..." : "Log Hours"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Photo Upload Section ──────────────────────────────────────────────────────

function PhotoSection({ wo, onRefresh }: { wo: WorkOrderDetail; onRefresh: () => void }) {
  const [isUploading, setIsUploading] = useState(false);
  const [photoType, setPhotoType] = useState<"before" | "after" | "general">("general");
  const [caption, setCaption] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const addPhoto = useAddWorkOrderPhoto();
  const deletePhoto = useDeleteWorkOrderPhoto();

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    try {
      // Step 1: get presigned URL
      const urlRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "image/jpeg" }),
        credentials: "include",
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();

      // Step 2: upload directly to GCS
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "image/jpeg" },
      });
      if (!putRes.ok) throw new Error("Upload to storage failed");

      // Step 3: record in DB
      addPhoto.mutate(
        { id: wo.id, data: { fileKey: objectPath, photoType, caption: caption || undefined } },
        {
          onSuccess: () => { toast.success("Photo uploaded"); setCaption(""); onRefresh(); },
          onError: () => toast.error("Failed to save photo record"),
        }
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Upload controls */}
      <div className="flex flex-wrap gap-3 items-end p-4 rounded-lg border border-dashed border-border bg-card">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Photo Type</Label>
          <Select value={photoType} onValueChange={(v) => setPhotoType(v as "before" | "after" | "general")}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="before">Before</SelectItem>
              <SelectItem value="after">After</SelectItem>
              <SelectItem value="general">General</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <Label className="text-xs text-muted-foreground mb-1 block">Caption (optional)</Label>
          <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Describe the photo..." />
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
        <Button
          variant="outline"
          className="gap-2"
          disabled={isUploading}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          {isUploading ? "Uploading..." : "Upload Photo"}
        </Button>
      </div>

      {/* Photo gallery */}
      {wo.photos.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No photos attached yet</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {wo.photos.map((p) => (
            <div key={p.id} className="relative group rounded-lg border border-border overflow-hidden bg-card">
              <div className="aspect-video flex items-center justify-center bg-muted/30 relative">
                <Camera className="h-8 w-8 text-muted-foreground/40" />
                <span className="absolute top-2 left-2">
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-black/60 text-white capitalize">{p.photoType}</span>
                </span>
                <button
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 rounded p-1"
                  onClick={() => {
                    deletePhoto.mutate(
                      { id: wo.id, photoId: p.id },
                      { onSuccess: () => { toast.success("Photo deleted"); onRefresh(); }, onError: () => toast.error("Failed") }
                    );
                  }}
                >
                  <Trash2 className="h-3 w-3 text-white" />
                </button>
              </div>
              {p.caption && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">{p.caption}</div>
              )}
              <div className="px-2 pb-1.5 text-xs text-muted-foreground/60 truncate">{p.fileKey}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Signature Section ─────────────────────────────────────────────────────────

function SignatureSection({ wo, onRefresh }: { wo: WorkOrderDetail; onRefresh: () => void }) {
  const [sigType, setSigType] = useState<"mechanic" | "supervisor">("mechanic");
  const [showPad, setShowPad] = useState(false);
  const saveSignature = useSaveWorkOrderSignature();

  const handleSave = (dataUrl: string) => {
    saveSignature.mutate(
      { id: wo.id, data: { signatureType: sigType, signatureData: dataUrl } },
      {
        onSuccess: () => { toast.success("Signature saved"); setShowPad(false); onRefresh(); },
        onError: (err) => toast.error((err as any)?.response?.data?.error ?? "Failed to save signature"),
      }
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {wo.signatures.length > 0 && (
        <div className="flex flex-col gap-2">
          {wo.signatures.map((sig) => (
            <div key={sig.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
              <div>
                <p className="text-sm font-medium capitalize">{sig.signatureType} Signature</p>
                <p className="text-xs text-muted-foreground">
                  Signed by {sig.signedByName ?? "Unknown"} · {fmtDt(sig.signedAt)}
                </p>
              </div>
              <div className="rounded border border-border bg-[#0A1628] px-3 py-1">
                <PenLine className="h-4 w-4 text-white/40" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* OOS release requirement */}
      {wo.status === "out_of_service" && !wo.signatures.some((s) => s.signatureType === "mechanic") && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-400">OOS Release Required</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Mechanic signature is required before this vehicle can be released from Out of Service.
            </p>
          </div>
        </div>
      )}

      {!showPad ? (
        <Button variant="outline" className="gap-2 self-start" onClick={() => setShowPad(true)}>
          <PenLine className="h-4 w-4" />
          Add Signature
        </Button>
      ) : (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold">Capture Signature</h4>
            <Select value={sigType} onValueChange={(v) => setSigType(v as "mechanic" | "supervisor")}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mechanic">Mechanic</SelectItem>
                <SelectItem value="supervisor">Supervisor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SignaturePad onSave={handleSave} height={150} />
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowPad(false)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Invoice Upload ────────────────────────────────────────────────────────────

function InvoiceSection({ wo, onRefresh }: { wo: WorkOrderDetail; onRefresh: () => void }) {
  const [form, setForm] = useState({ vendorName: "", invoiceNumber: "", invoiceDate: "", totalAmount: "", notes: "" });
  const [isUploading, setIsUploading] = useState(false);
  const [fileKey, setFileKey] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const addInvoice = useAddWorkOrderInvoice();

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const urlRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "application/pdf" }),
        credentials: "include",
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();
      await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/pdf" } });
      setFileKey(objectPath);
      toast.success("Invoice file uploaded");
    } catch (err) {
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = () => {
    if (!form.vendorName || !form.invoiceNumber || !form.totalAmount) {
      toast.error("Vendor, invoice number, and amount are required");
      return;
    }
    addInvoice.mutate(
      { id: wo.id, data: { ...form, fileKey: fileKey || undefined } },
      {
        onSuccess: () => { toast.success("Invoice added"); onRefresh(); setForm({ vendorName: "", invoiceNumber: "", invoiceDate: "", totalAmount: "", notes: "" }); setFileKey(""); },
        onError: (err) => toast.error((err as any)?.response?.data?.error ?? "Failed"),
      }
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Existing invoices */}
      {wo.invoices.length > 0 && (
        <div className="flex flex-col gap-2">
          {wo.invoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
              <div>
                <p className="text-sm font-medium">{inv.vendorName} — #{inv.invoiceNumber}</p>
                <p className="text-xs text-muted-foreground">
                  ${parseFloat(inv.totalAmount).toFixed(2)} · {fmt(inv.invoiceDate)}
                  {inv.notes && ` · ${inv.notes}`}
                </p>
              </div>
              {inv.fileKey && <Receipt className="h-4 w-4 text-muted-foreground" />}
            </div>
          ))}
        </div>
      )}

      {/* Add invoice form */}
      <div className="rounded-lg border border-dashed border-border bg-card p-4">
        <h4 className="text-sm font-semibold mb-3">Add Vendor Invoice</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Vendor Name *</Label>
            <Input className="mt-1" value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Invoice Number *</Label>
            <Input className="mt-1" value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Invoice Date</Label>
            <Input className="mt-1" type="date" value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Total Amount ($) *</Label>
            <Input className="mt-1" type="number" step="0.01" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Notes</Label>
            <Input className="mt-1" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Attach Invoice PDF/Image</Label>
            <div className="mt-1 flex items-center gap-2">
              <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ""; }} />
              <Button type="button" variant="outline" size="sm" className="gap-1" disabled={isUploading} onClick={() => fileRef.current?.click()}>
                <Upload className="h-3 w-3" />
                {isUploading ? "Uploading..." : fileKey ? "Replace File" : "Attach File"}
              </Button>
              {fileKey && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{fileKey}</span>}
            </div>
          </div>
        </div>
        <div className="flex justify-end mt-3">
          <Button size="sm" onClick={handleSubmit} disabled={addInvoice.isPending}>
            {addInvoice.isPending ? "Saving..." : "Add Invoice"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WorkOrderDetailPage({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [showTransition, setShowTransition] = useState(false);
  const [showAddPart, setShowAddPart] = useState(false);
  const [showAddLabour, setShowAddLabour] = useState(false);
  const [comment, setComment] = useState("");

  const { data: wo, isLoading, error } = useGetWorkOrder(id);
  const { data: currentUser } = useGetMe();
  const deletePartMutation = useDeleteWorkOrderPart();
  const deleteLabourMutation = useDeleteWorkOrderLabour();
  const addComment = useAddWorkOrderComment();
  const updateWo = useUpdateWorkOrder();
  const transitionStatus = useTransitionWorkOrderStatus();

  // Odometer inline-edit state
  const [editingOdometer, setEditingOdometer] = useState(false);
  const [odometerDraft, setOdometerDraft] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: getGetWorkOrderQueryKey(id) });

  const handleOdometerSave = () => {
    const val = odometerDraft === "" ? null : Number(odometerDraft);
    if (odometerDraft !== "" && (isNaN(val as number) || (val as number) < 0)) {
      toast.error("Enter a valid odometer reading"); return;
    }
    updateWo.mutate(
      { id, data: { odometerAtService: val as any } },
      {
        onSuccess: () => { toast.success("Odometer saved"); setEditingOdometer(false); refresh(); },
        onError: () => toast.error("Failed to save odometer"),
      }
    );
  };

  const handleAddComment = () => {
    if (!comment.trim()) return;
    addComment.mutate(
      { id, data: { body: comment.trim() } },
      {
        onSuccess: () => { toast.success("Comment added"); setComment(""); refresh(); },
        onError: () => toast.error("Failed to add comment"),
      }
    );
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground animate-pulse">Loading work order...</div>;
  }
  if (error || !wo) {
    return (
      <div className="flex flex-col items-center py-20 gap-3">
        <AlertTriangle className="h-10 w-10 text-red-400" />
        <p className="text-muted-foreground">Work order not found</p>
        <Button variant="outline" onClick={() => setLocation("/work-orders")}>Back to Work Orders</Button>
      </div>
    );
  }

  const userRole = (currentUser as any)?.role ?? "driver";
  const nextStatuses = getAvailableTransitions(wo.status, userRole);
  const hasNextStatuses = nextStatuses.length > 0;

  const quickTransition = (() => {
    const candidates: Record<string, { to: string; label: string; icon: typeof Wrench; className?: string }> = {
      draft: { to: "assigned", label: "Assign work order", icon: Play },
      assigned: { to: "checked_in", label: "Start work", icon: Play },
      checked_in: { to: "inspection_in_progress", label: "Start inspection", icon: Play },
      inspection_in_progress: { to: "qc_review", label: "Submit for review", icon: Send },
      repair_in_progress: { to: "qc_review", label: "Submit for review", icon: Send },
      waiting_for_part: { to: "repair_in_progress", label: "Resume repair", icon: RotateCcw },
      qc_review: { to: "completed", label: "Complete work order", icon: CheckCircle2, className: "bg-emerald-600 hover:bg-emerald-700" },
      completed: { to: "released", label: "Release to service", icon: CheckCircle2, className: "bg-emerald-600 hover:bg-emerald-700" },
    };
    const candidate = candidates[wo.status];
    return candidate && nextStatuses.includes(candidate.to) ? candidate : null;
  })();

  const handleQuickTransition = () => {
    if (!quickTransition) return;
    transitionStatus.mutate(
      { id: wo.id, data: { status: quickTransition.to as WorkOrderStatusInput["status"] } },
      {
        onSuccess: () => {
          toast.success(
            quickTransition.to === "completed"
              ? "Work order completed"
              : quickTransition.to === "qc_review"
                ? "Work order submitted for review"
                : "Work order status updated"
          );
          refresh();
        },
        onError: (err) => toast.error((err as any)?.response?.data?.error ?? "Status update failed"),
      }
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Back + actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/work-orders")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-foreground font-mono">{wo.woNumber}</h1>
              <StatusBadge status={wo.status} />
              <span className={`text-xs font-bold uppercase ${PRIORITY_COLORS[wo.priority]}`}>{wo.priority}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {wo.vehicleUnitNumber} · {wo.workOrderType?.replace(/_/g, " ")}
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={async () => {
              try {
                const res = await fetch(`/api/work-orders/${wo.id}/pdf`, { credentials: "include" });
                if (!res.ok) throw new Error(`Error ${res.status}`);
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = `WO-${wo.woNumber}.pdf`;
                document.body.appendChild(a); a.click();
                document.body.removeChild(a); URL.revokeObjectURL(url);
              } catch { toast.error("PDF download failed. Please try again."); }
            }}
          >
            <FileDown className="h-4 w-4" />
            PDF
          </Button>
          {quickTransition && !transitionStatus.isPending && (
            <Button
              size="sm"
              className={`gap-1.5 ${quickTransition.className ?? ""}`}
              onClick={handleQuickTransition}
              data-testid={`button-quick-status-${quickTransition.to}`}
            >
              <quickTransition.icon className="h-4 w-4" />
              {quickTransition.label}
            </Button>
          )}
          {hasNextStatuses && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => setShowTransition(true)}
              disabled={transitionStatus.isPending}
            >
              <Wrench className="h-4 w-4" />
              More status options
            </Button>
          )}
        </div>
      </div>

      {/* OOS warning banner */}
      {wo.status === "out_of_service" && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/40 bg-red-500/10 p-4">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-400">Vehicle is Out of Service</p>
            <p className="text-xs text-muted-foreground mt-1">
              Mechanic signature and supervisor approval required before releasing to service. Use the Signatures tab to capture required signatures.
            </p>
          </div>
        </div>
      )}

      {/* Header info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Vehicle", value: `${wo.vehicleUnitNumber} — ${wo.vehicleYear ?? ""} ${wo.vehicleMake ?? ""} ${wo.vehicleModel ?? ""}`.trim() },
          { label: "Customer", value: wo.customerName ?? "Internal / no customer" },
          { label: "Assigned Mechanic", value: wo.assignedMechanicName ?? "Unassigned" },
          { label: "Scheduled", value: fmt(wo.scheduledDate) },
          { label: "Labour Hours", value: wo.totalLabourHours ? `${parseFloat(wo.totalLabourHours).toFixed(1)} hrs` : "—" },
          { label: "Parts Cost", value: wo.totalPartsCost ? `$${parseFloat(wo.totalPartsCost).toFixed(2)}` : "—" },
          { label: "Started", value: fmtDt(wo.startedAt) },
          { label: "Completed", value: fmtDt(wo.completedAt) },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="text-sm font-semibold mt-0.5 truncate" title={item.value}>{item.value}</p>
          </div>
        ))}

        {/* Odometer — inline editable */}
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground mb-1">Odometer at Service</p>
          {editingOdometer ? (
            <div className="flex items-center gap-1">
              <Input
                autoFocus
                type="number"
                min={0}
                className="h-7 text-sm font-mono px-2 py-0"
                placeholder="km"
                value={odometerDraft}
                onChange={(e) => setOdometerDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleOdometerSave(); if (e.key === "Escape") setEditingOdometer(false); }}
              />
              <button onClick={handleOdometerSave} disabled={updateWo.isPending} className="text-green-400 hover:text-green-300 disabled:opacity-50">
                <Check className="h-4 w-4" />
              </button>
              <button onClick={() => setEditingOdometer(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group">
              <p className="text-sm font-semibold font-mono">
                {wo.odometerAtService ? `${wo.odometerAtService.toLocaleString()} km` : "—"}
              </p>
              {!wo.isLocked && (
                <button
                  onClick={() => { setOdometerDraft(wo.odometerAtService ? String(wo.odometerAtService) : ""); setEditingOdometer(true); }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                  title="Edit odometer"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {wo.description && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Description</p>
          <p className="text-sm text-foreground">{wo.description}</p>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="parts">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="parts" className="gap-1">
            <Package className="h-3.5 w-3.5" />
            Parts ({wo.parts.length})
          </TabsTrigger>
          <TabsTrigger value="labour" className="gap-1">
            <Clock className="h-3.5 w-3.5" />
            Labour ({wo.labour.length})
          </TabsTrigger>
          <TabsTrigger value="photos" className="gap-1">
            <Camera className="h-3.5 w-3.5" />
            Photos ({wo.photos.length})
          </TabsTrigger>
          <TabsTrigger value="signatures" className="gap-1">
            <PenLine className="h-3.5 w-3.5" />
            Signatures ({wo.signatures.length})
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-1">
            <Receipt className="h-3.5 w-3.5" />
            Invoices ({wo.invoices.length})
          </TabsTrigger>
          <TabsTrigger value="comments" className="gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            Comments ({wo.comments.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1">
            <Clock className="h-3.5 w-3.5" />
            History ({wo.statusHistory.length})
          </TabsTrigger>
          {["pm1", "pm2", "trailer_maintenance", "reefer_maintenance"].includes(wo.workOrderType) && (
            <TabsTrigger value="checklist" className="gap-1">
              <ClipboardCheck className="h-3.5 w-3.5" />
              Checklist
            </TabsTrigger>
          )}
        </TabsList>

        {/* Parts tab */}
        <TabsContent value="parts" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-base">Parts Used</CardTitle>
              {!wo.isLocked && (
                <Button size="sm" variant="outline" className="gap-1" onClick={() => setShowAddPart(true)}>
                  <Plus className="h-3 w-3" /> Add Part
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {wo.parts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No parts recorded yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="text-left py-2 font-medium">Part</th>
                        <th className="text-left py-2 font-medium">Vendor</th>
                        <th className="text-left py-2 font-medium">Part #</th>
                        <th className="text-right py-2 font-medium">Qty</th>
                        <th className="text-right py-2 font-medium">Unit</th>
                        <th className="text-right py-2 font-medium">Total</th>
                        {!wo.isLocked && <th className="w-8" />}
                      </tr>
                    </thead>
                    <tbody>
                      {wo.parts.map((p) => (
                        <tr key={p.id} className="border-b border-border/40 hover:bg-muted/10">
                          <td className="py-2 font-medium">{p.partDescription}</td>
                          <td className="py-2 text-muted-foreground">{p.vendorName}</td>
                          <td className="py-2 text-muted-foreground">{p.partNumber ?? "—"}</td>
                          <td className="py-2 text-right">{p.quantity}</td>
                          <td className="py-2 text-right">${parseFloat(p.unitCost).toFixed(2)}</td>
                          <td className="py-2 text-right font-semibold">${parseFloat(p.totalCost).toFixed(2)}</td>
                          {!wo.isLocked && (
                            <td className="py-2">
                              <button
                                onClick={() => deletePartMutation.mutate({ id: wo.id, partId: p.id }, { onSuccess: () => { toast.success("Part removed"); refresh(); } })}
                                className="text-muted-foreground hover:text-red-400"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    {wo.parts.length > 0 && (
                      <tfoot>
                        <tr className="font-semibold">
                          <td colSpan={5} className="py-2 text-right text-muted-foreground text-xs">Total Parts Cost</td>
                          <td className="py-2 text-right text-primary">
                            ${wo.parts.reduce((s, p) => s + parseFloat(p.totalCost), 0).toFixed(2)}
                          </td>
                          {!wo.isLocked && <td />}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Labour tab */}
        <TabsContent value="labour" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-base">Labour Log</CardTitle>
              {!wo.isLocked && (
                <Button size="sm" variant="outline" className="gap-1" onClick={() => setShowAddLabour(true)}>
                  <Plus className="h-3 w-3" /> Log Hours
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {wo.labour.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No labour entries yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="text-left py-2 font-medium">Mechanic</th>
                        <th className="text-left py-2 font-medium">Date</th>
                        <th className="text-right py-2 font-medium">Hours</th>
                        <th className="text-left py-2 font-medium">Type</th>
                        <th className="text-left py-2 font-medium">Notes</th>
                        {!wo.isLocked && <th className="w-8" />}
                      </tr>
                    </thead>
                    <tbody>
                      {wo.labour.map((l) => (
                        <tr key={l.id} className="border-b border-border/40 hover:bg-muted/10">
                          <td className="py-2 font-medium">{l.mechanicName ?? "—"}</td>
                          <td className="py-2 text-muted-foreground">{fmt(l.startTime as string)}</td>
                          <td className="py-2 text-right">{l.hoursWorked ? `${parseFloat(l.hoursWorked).toFixed(2)} hrs` : "—"}</td>
                          <td className="py-2 capitalize text-muted-foreground">{l.labourType}</td>
                          <td className="py-2 text-muted-foreground">{l.notes ?? "—"}</td>
                          {!wo.isLocked && (
                            <td className="py-2">
                              <button
                                onClick={() => deleteLabourMutation.mutate({ id: wo.id, labourId: l.id }, { onSuccess: () => { toast.success("Entry removed"); refresh(); } })}
                                className="text-muted-foreground hover:text-red-400"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-semibold">
                        <td colSpan={2} className="py-2 text-right text-muted-foreground text-xs">Total Labour</td>
                        <td className="py-2 text-right text-primary">
                          {wo.labour.reduce((s, l) => s + parseFloat(l.hoursWorked ?? "0"), 0).toFixed(2)} hrs
                        </td>
                        <td colSpan={2} />
                        {!wo.isLocked && <td />}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Photos tab */}
        <TabsContent value="photos" className="mt-4">
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-base">Photos</CardTitle></CardHeader>
            <CardContent><PhotoSection wo={wo} onRefresh={refresh} /></CardContent>
          </Card>
        </TabsContent>

        {/* Signatures tab */}
        <TabsContent value="signatures" className="mt-4">
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-base">Digital Signatures</CardTitle></CardHeader>
            <CardContent><SignatureSection wo={wo} onRefresh={refresh} /></CardContent>
          </Card>
        </TabsContent>

        {/* Invoices tab */}
        <TabsContent value="invoices" className="mt-4">
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-base">Vendor Invoices</CardTitle></CardHeader>
            <CardContent><InvoiceSection wo={wo} onRefresh={refresh} /></CardContent>
          </Card>
        </TabsContent>

        {/* Comments tab */}
        <TabsContent value="comments" className="mt-4">
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-base">Comments</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {wo.comments.map((c) => (
                  <div key={c.id} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{c.authorName ?? "Unknown"}</span>
                      <span className="text-xs text-muted-foreground">{fmtDt(c.createdAt)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{c.body}</p>
                  </div>
                ))}
                <div className="flex gap-2 mt-2">
                  <Textarea
                    placeholder="Add a comment..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                  <Button
                    className="self-end"
                    size="sm"
                    onClick={handleAddComment}
                    disabled={!comment.trim() || addComment.isPending}
                  >
                    Post
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History tab */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-base">Status Timeline</CardTitle></CardHeader>
            <CardContent>
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                <div className="flex flex-col gap-4 pl-12">
                  {wo.statusHistory.map((h, i) => (
                    <div key={h.id} className="relative">
                      <div className="absolute -left-8 mt-1 flex h-4 w-4 items-center justify-center rounded-full bg-card border-2 border-primary" />
                      <div className="rounded-lg border border-border bg-card p-3">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {h.fromStatus && <StatusBadge status={h.fromStatus} />}
                          {h.fromStatus && <span className="text-muted-foreground text-xs">→</span>}
                          <StatusBadge status={h.toStatus} />
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>By {h.changedByName ?? "Unknown"}</span>
                          <span>{fmtDt(h.createdAt)}</span>
                        </div>
                        {h.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{h.notes}"</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Checklist tab */}
        {["pm1", "pm2", "trailer_maintenance", "reefer_maintenance"].includes(wo.workOrderType) && (
          <TabsContent value="checklist" className="mt-4">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base">Digital Inspection Checklist</CardTitle>
              </CardHeader>
              <CardContent>
                <WorkOrderChecklist
                  woId={wo.id}
                  readOnly={!!wo.isLocked || !["mechanic", "admin"].includes(currentUser?.role ?? "")}
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Dialogs */}
      <TransitionDialog wo={wo} open={showTransition} onClose={() => setShowTransition(false)} onSuccess={refresh} userRole={userRole} />
      <AddPartDialog woId={wo.id} open={showAddPart} onClose={() => setShowAddPart(false)} onSuccess={refresh} />
      <AddLabourDialog woId={wo.id} open={showAddLabour} onClose={() => setShowAddLabour(false)} onSuccess={refresh} />
    </div>
  );
}
