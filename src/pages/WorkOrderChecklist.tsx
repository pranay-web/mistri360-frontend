import { useState, useRef } from "react";
import {
  useGetWorkOrderChecklist,
  useSaveChecklistItemResponse,
  useSubmitWorkOrderChecklist,
  getGetWorkOrderChecklistQueryKey,
  type ChecklistItemWithResponse,
  type ChecklistInstanceDetail,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle2,
  Eye,
  AlertTriangle,
  XCircle,
  Minus,
  Camera,
  Send,
  Upload,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

// ── Status config ──────────────────────────────────────────────────────────────

type ItemStatus = "pass" | "monitor" | "repair_required" | "major_defect" | "out_of_service" | "n_a";

const STATUS_BUTTONS: Array<{
  value: ItemStatus;
  label: string;
  icon: React.ReactNode;
  activeClass: string;
  textClass: string;
}> = [
  {
    value: "pass",
    label: "Pass",
    icon: <CheckCircle2 className="h-4 w-4" />,
    activeClass: "bg-green-600 border-green-600 text-white",
    textClass: "text-green-400",
  },
  {
    value: "monitor",
    label: "Monitor",
    icon: <Eye className="h-4 w-4" />,
    activeClass: "bg-amber-500 border-amber-500 text-white",
    textClass: "text-amber-400",
  },
  {
    value: "repair_required",
    label: "Repair",
    icon: <AlertTriangle className="h-4 w-4" />,
    activeClass: "bg-orange-600 border-orange-600 text-white",
    textClass: "text-orange-400",
  },
  {
    value: "major_defect",
    label: "Major",
    icon: <XCircle className="h-4 w-4" />,
    activeClass: "bg-red-600 border-red-600 text-white",
    textClass: "text-red-400",
  },
  {
    value: "out_of_service",
    label: "OOS",
    icon: <XCircle className="h-4 w-4" />,
    activeClass: "bg-red-900 border-red-900 text-white",
    textClass: "text-red-600",
  },
  {
    value: "n_a",
    label: "N/A",
    icon: <Minus className="h-4 w-4" />,
    activeClass: "bg-gray-600 border-gray-600 text-white",
    textClass: "text-gray-400",
  },
];

function getStatusConfig(status: ItemStatus | null) {
  if (!status) return null;
  return STATUS_BUTTONS.find((s) => s.value === status) ?? null;
}

const NEEDS_NOTES: ItemStatus[] = ["major_defect", "out_of_service"];
const NEEDS_EXTRA: ItemStatus[] = ["repair_required", "major_defect", "out_of_service", "monitor"];

// ── Single checklist item ─────────────────────────────────────────────────────

function ChecklistItem({
  item,
  locked,
  onSave,
  isSaving,
}: {
  item: ChecklistItemWithResponse;
  locked: boolean;
  onSave: (itemId: number, data: { status: ItemStatus; notes?: string; measurement?: string; photoFileKey?: string }) => void;
  isSaving: boolean;
}) {
  const [localStatus, setLocalStatus] = useState<ItemStatus | null>(item.status as ItemStatus | null);
  const [localNotes, setLocalNotes] = useState(item.notes ?? "");
  const [localMeasurement, setLocalMeasurement] = useState(item.measurement ?? "");
  const [localPhotoKey, setLocalPhotoKey] = useState(item.photoFileKey ?? "");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isDefect = localStatus === "repair_required" || localStatus === "major_defect" || localStatus === "out_of_service";
  const needsNotes = NEEDS_NOTES.includes(localStatus as ItemStatus);
  const showExtra = localStatus && NEEDS_EXTRA.includes(localStatus as ItemStatus);
  const statusCfg = getStatusConfig(localStatus);

  const handleStatusChange = (s: ItemStatus) => {
    if (locked) return;
    // Never toggle back to null — selecting the active button is a no-op
    if (localStatus === s) return;

    setLocalStatus(s);

    // If major_defect or out_of_service require notes, don't auto-save yet;
    // user must fill in notes and blur to trigger the save.
    if (NEEDS_NOTES.includes(s) && !localNotes.trim()) {
      return;
    }

    onSave(item.itemId, {
      status: s,
      notes: localNotes || undefined,
      measurement: localMeasurement || undefined,
      photoFileKey: localPhotoKey || undefined,
    });
  };

  const handleBlurSave = () => {
    if (!localStatus || locked) return;
    if (NEEDS_NOTES.includes(localStatus) && !localNotes.trim()) return;
    onSave(item.itemId, {
      status: localStatus,
      notes: localNotes || undefined,
      measurement: localMeasurement || undefined,
      photoFileKey: localPhotoKey || undefined,
    });
  };

  const handlePhotoUpload = async (file: File) => {
    setIsUploadingPhoto(true);
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
      setLocalPhotoKey(objectPath);
      if (localStatus) {
        onSave(item.itemId, {
          status: localStatus,
          notes: localNotes || undefined,
          measurement: localMeasurement || undefined,
          photoFileKey: objectPath,
        });
      }
      toast.success("Photo uploaded");
    } catch {
      toast.error("Photo upload failed");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const rowClass = isDefect
    ? "rounded-lg border border-red-600/40 bg-red-950/20 p-3 md:p-4"
    : "rounded-lg border border-border bg-card p-3 md:p-4";

  return (
    <div className={rowClass}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-sm font-medium text-foreground leading-snug flex-1">{item.itemDescription}</p>
        {statusCfg && !locked && (
          <span className={`text-xs font-semibold shrink-0 ${statusCfg.textClass}`}>
            {statusCfg.label}
          </span>
        )}
        {locked && item.status && (
          <span className={`text-xs font-semibold shrink-0 ${getStatusConfig(item.status as ItemStatus)?.textClass}`}>
            {getStatusConfig(item.status as ItemStatus)?.label}
          </span>
        )}
      </div>

      {/* Status buttons */}
      {!locked && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-2">
          {STATUS_BUTTONS.map((btn) => (
            <button
              key={btn.value}
              type="button"
              onClick={() => handleStatusChange(btn.value)}
              disabled={isSaving}
              className={`flex items-center justify-center gap-1 rounded-md border py-2 text-xs font-medium transition-all active:scale-95
                ${localStatus === btn.value
                  ? btn.activeClass
                  : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
            >
              {btn.icon}
              <span className="hidden sm:inline">{btn.label}</span>
              <span className="sm:hidden">{btn.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Extra fields — visible when locked too */}
      {(showExtra || (locked && item.notes)) && (
        <div className="mt-2 flex flex-col gap-2">
          {/* Measurement */}
          {item.requiresMeasurement && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground w-24 shrink-0">
                Measurement
                {item.measurementUnit && ` (${item.measurementUnit})`}
              </label>
              {locked ? (
                <span className="text-sm font-mono text-foreground">
                  {item.measurement ?? "—"} {item.measurementUnit ?? ""}
                </span>
              ) : (
                <Input
                  type="number"
                  step="any"
                  className="h-7 text-sm w-32"
                  placeholder={item.measurementUnit ?? "value"}
                  value={localMeasurement}
                  onChange={(e) => setLocalMeasurement(e.target.value)}
                  onBlur={handleBlurSave}
                />
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Notes{needsNotes && !locked ? " (required)" : ""}
            </label>
            {locked ? (
              item.notes ? (
                <p className="text-sm text-foreground">{item.notes}</p>
              ) : null
            ) : (
              <Textarea
                rows={2}
                className={`text-sm resize-none ${needsNotes && !localNotes.trim() ? "border-red-500" : ""}`}
                placeholder="Describe the issue..."
                value={localNotes}
                onChange={(e) => setLocalNotes(e.target.value)}
                onBlur={handleBlurSave}
              />
            )}
          </div>

          {/* Photo */}
          {!locked && (
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); e.target.value = ""; }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                disabled={isUploadingPhoto}
                onClick={() => fileRef.current?.click()}
              >
                {isUploadingPhoto ? <Upload className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                {localPhotoKey ? "Replace Photo" : "Add Photo"}
              </Button>
              {localPhotoKey && <span className="text-xs text-muted-foreground truncate max-w-[140px]">Photo attached ✓</span>}
            </div>
          )}

          {/* Locked photo indicator */}
          {locked && item.photoFileKey && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Camera className="h-3 w-3" /> Photo attached
            </div>
          )}
        </div>
      )}

      {/* Locked measurement-only items */}
      {locked && item.requiresMeasurement && !showExtra && item.measurement && (
        <div className="mt-2 text-sm text-muted-foreground">
          {item.measurement} {item.measurementUnit ?? ""}
        </div>
      )}

      {/* Responded by */}
      {locked && item.respondedByName && (
        <p className="text-xs text-muted-foreground mt-2">
          By {item.respondedByName}
        </p>
      )}
    </div>
  );
}

// ── Main checklist form ────────────────────────────────────────────────────────

export default function WorkOrderChecklist({ woId, readOnly }: { woId: number; readOnly?: boolean }) {
  const qc = useQueryClient();
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const { data: checklist, isLoading, error } = useGetWorkOrderChecklist(woId);
  const saveItem = useSaveChecklistItemResponse();
  const submit = useSubmitWorkOrderChecklist();

  const refresh = () => qc.invalidateQueries({ queryKey: getGetWorkOrderChecklistQueryKey(woId) });

  const handleSave = (
    itemId: number,
    data: { status: ItemStatus; notes?: string; measurement?: string; photoFileKey?: string }
  ) => {
    saveItem.mutate(
      { id: woId, itemId, data },
      {
        onSuccess: () => refresh(),
        onError: (err) => toast.error((err as any)?.response?.data?.error ?? "Failed to save response"),
      }
    );
  };

  const handleSubmit = () => {
    submit.mutate(
      { id: woId },
      {
        onSuccess: (res) => {
          toast.success(
            `Checklist submitted. ${res.defectsCreated > 0 ? `${res.defectsCreated} defect(s) auto-logged.` : "No defects flagged."}`
          );
          refresh();
          setConfirmSubmit(false);
        },
        onError: (err) => {
          const errData = (err as any)?.response?.data;
          toast.error(errData?.error ?? "Submit failed");
          setConfirmSubmit(false);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground animate-pulse">
        Loading checklist…
      </div>
    );
  }

  if (error || !checklist) {
    const msg = (error as any)?.response?.data?.error;
    if (msg?.includes("does not have a checklist")) {
      return (
        <div className="py-8 text-center text-muted-foreground text-sm">
          This work order type does not require a digital checklist.
        </div>
      );
    }
    return (
      <div className="py-8 text-center text-red-400 text-sm">
        {msg ?? "Failed to load checklist"}
      </div>
    );
  }

  const locked = checklist.isLocked || !!readOnly;
  const progress = checklist.totalCount > 0
    ? Math.round((checklist.completedCount / checklist.totalCount) * 100)
    : 0;
  const canSubmit = !locked && checklist.completedCount === checklist.totalCount;

  // Group items by category
  const categories = Array.from(new Set(checklist.items.map((i) => i.category)));
  const byCategory = categories.map((cat) => ({
    category: cat,
    items: checklist.items.filter((i) => i.category === cat),
  }));

  const defectItems = checklist.items.filter(
    (i) => i.status === "repair_required" || i.status === "major_defect" || i.status === "out_of_service"
  );

  const CHECKLIST_LABELS: Record<string, string> = {
    pm1: "PM1 Inspection",
    pm2: "PM2 Inspection",
    trailer: "Trailer Inspection",
    reefer: "Reefer Inspection",
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            {CHECKLIST_LABELS[checklist.checklistType] ?? checklist.checklistType}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {checklist.completedCount} / {checklist.totalCount} items completed
            {locked && checklist.submittedAt && ` · Submitted ${new Date(checklist.submittedAt).toLocaleDateString()}`}
          </p>
        </div>
        {locked && (
          <Badge variant="outline" className="gap-1 text-xs border-green-500/40 text-green-400">
            <Lock className="h-3 w-3" /> Submitted
          </Badge>
        )}
      </div>

      {/* Progress bar */}
      {!locked && (
        <div className="flex items-center gap-3">
          <Progress value={progress} className="flex-1 h-2" />
          <span className="text-sm font-semibold text-foreground w-10 text-right">{progress}%</span>
        </div>
      )}

      {/* Defect summary (locked view) */}
      {locked && defectItems.length > 0 && (
        <div className="rounded-lg border border-red-600/30 bg-red-950/20 p-3">
          <p className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            {defectItems.length} Defect{defectItems.length !== 1 ? "s" : ""} Found
          </p>
          <div className="flex flex-col gap-1">
            {defectItems.map((item) => {
              const cfg = getStatusConfig(item.status as ItemStatus);
              return (
                <div key={item.itemId} className="flex items-start gap-2 text-xs">
                  <span className={`font-semibold shrink-0 ${cfg?.textClass}`}>{cfg?.label}</span>
                  <span className="text-muted-foreground">[{item.category}] {item.itemDescription}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Checklist items by category */}
      <div className="flex flex-col gap-6">
        {byCategory.map(({ category, items }) => (
          <div key={category}>
            <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-2 px-1">
              {category}
            </h4>
            <div className="flex flex-col gap-2">
              {items.map((item) => (
                <ChecklistItem
                  key={item.itemId}
                  item={item}
                  locked={locked}
                  onSave={handleSave}
                  isSaving={saveItem.isPending}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Submit button */}
      {!locked && (
        <div className="sticky bottom-4 mt-2">
          <div className="rounded-xl border border-border bg-card/95 backdrop-blur p-3 flex items-center gap-3 shadow-xl">
            <div className="flex-1">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {checklist.totalCount - checklist.completedCount} item{checklist.totalCount - checklist.completedCount !== 1 ? "s" : ""} remaining
              </p>
            </div>
            <Button
              size="sm"
              className="gap-2 shrink-0"
              disabled={!canSubmit || submit.isPending}
              onClick={() => setConfirmSubmit(true)}
            >
              <Send className="h-4 w-4" />
              Submit Checklist
            </Button>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      <AlertDialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Checklist?</AlertDialogTitle>
            <AlertDialogDescription>
              Once submitted, the checklist is locked and cannot be modified.
              {defectItems.length > 0 && (
                <span className="block mt-2 text-amber-400 font-medium">
                  ⚠ {defectItems.length} flagged item{defectItems.length !== 1 ? "s" : ""} will auto-create defect records on the vehicle.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={submit.isPending}>
              {submit.isPending ? "Submitting…" : "Submit & Lock"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
