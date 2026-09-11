import { useState, useRef } from "react";
import { useLocation } from "wouter";
import {
  useGetVehiclePmcvi,
  useCreatePmcviRecord,
  useUpdatePmcviRecord,
  useUploadDriveOnDocument,
  useMarkPmcviPassed,
  useGetVehicleUsInspections,
  useCreateUsInspection,
  useGetVehicleRoadsideViolations,
  useCreateRoadsideViolation,
  useUpdateRoadsideViolation,
  useCheckPmcviReminders,
  useListVehicles,
  getGetVehiclePmcviQueryKey,
  getGetVehicleUsInspectionsQueryKey,
  getGetVehicleRoadsideViolationsQueryKey,
  type PmcviRecord,
  type UsInspectionRecord,
  type RoadsideViolation,
  type VehicleListItem,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Upload,
  FileText,
  Plus,
  XCircle,
  CalendarDays,
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { toast } from "sonner";

// ── Countdown badge ───────────────────────────────────────────────────────────

function ExpiryCountdown({ expiryDate }: { expiryDate: string }) {
  const days = differenceInDays(parseISO(expiryDate), new Date());
  const color =
    days < 0 ? "text-red-500 border-red-500/40 bg-red-950/20" :
    days <= 14 ? "text-red-400 border-red-400/40 bg-red-950/10" :
    days <= 30 ? "text-orange-400 border-orange-400/40 bg-orange-950/10" :
    days <= 90 ? "text-amber-400 border-amber-400/40 bg-amber-950/10" :
    "text-green-400 border-green-400/40 bg-green-950/10";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${color}`}>
      <CalendarDays className="h-3 w-3" />
      {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
    </span>
  );
}

// ── Vehicle selector ──────────────────────────────────────────────────────────

function VehicleSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: vehicles = [] } = useListVehicles();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Select vehicle..." />
      </SelectTrigger>
      <SelectContent>
        {(vehicles as VehicleListItem[]).map((v) => (
          <SelectItem key={v.id} value={String(v.id)}>
            {v.unitNumber} — {v.make} {v.model}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── PMCVI tab ────────────────────────────────────────────────────────────────

function PmcviTab() {
  const qc = useQueryClient();
  const [vehicleId, setVehicleId] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ inspectionDate: "", expiryDate: "", result: "pending", inspectionStationName: "", inspectorName: "", certificateNumber: "", repairNotes: "", reinspectionDate: "" });
  const [uploadingFor, setUploadingFor] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const createPmcvi = useCreatePmcviRecord();
  const updatePmcvi = useUpdatePmcviRecord();
  const uploadDriveOn = useUploadDriveOnDocument();
  const markPassed = useMarkPmcviPassed();
  const checkReminders = useCheckPmcviReminders();

  const vid = Number(vehicleId);
  const { data: records = [], isLoading } = useGetVehiclePmcvi(vid, { query: { queryKey: getGetVehiclePmcviQueryKey(vid), enabled: !!vehicleId } });

  const refreshRecords = () => {
    if (vehicleId) qc.invalidateQueries({ queryKey: getGetVehiclePmcviQueryKey(Number(vehicleId)) });
  };

  const handleAddSubmit = () => {
    if (!vehicleId || !form.inspectionDate || !form.expiryDate) {
      toast.error("Inspection date and expiry date are required"); return;
    }
    createPmcvi.mutate(
      { id: Number(vehicleId), data: { ...form, result: form.result as any } },
      { onSuccess: () => { toast.success("PMCVI record added"); refreshRecords(); setShowAdd(false); setForm({ inspectionDate: "", expiryDate: "", result: "pending", inspectionStationName: "", inspectorName: "", certificateNumber: "", repairNotes: "", reinspectionDate: "" }); }, onError: (e) => toast.error((e as any)?.response?.data?.error ?? "Failed") }
    );
  };

  const handleDriveOnUpload = async (record: PmcviRecord, file: File) => {
    setUploadingFor(record.id);
    try {
      const urlRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "application/pdf" }),
        credentials: "include",
      });
      if (!urlRes.ok) throw new Error("Upload URL failed");
      const { uploadURL, objectPath } = await urlRes.json();
      await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/pdf" } });
      uploadDriveOn.mutate(
        { id: record.id, data: { fileKey: objectPath } },
        { onSuccess: () => { toast.success("DriveON certificate uploaded"); refreshRecords(); }, onError: (e) => toast.error((e as any)?.response?.data?.error ?? "Upload failed") }
      );
    } catch { toast.error("File upload failed"); }
    finally { setUploadingFor(null); }
  };

  const handleMarkPassed = (record: PmcviRecord) => {
    markPassed.mutate({ id: record.id }, {
      onSuccess: () => { toast.success("PMCVI marked as officially passed"); refreshRecords(); },
      onError: (e) => toast.error((e as any)?.response?.data?.error ?? "Failed"),
    });
  };

  const handleCheckReminders = () => {
    checkReminders.mutate(undefined, {
      onSuccess: (r: any) => toast.success(`Reminder check complete — ${r.remindersCreated} reminder(s) created`),
      onError: () => toast.error("Reminder check failed"),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-3">
          <VehicleSelector value={vehicleId} onChange={setVehicleId} />
          {vehicleId && <Button size="sm" className="gap-1" onClick={() => setShowAdd(true)}><Plus className="h-3 w-3" /> Add PMCVI Record</Button>}
        </div>
        <Button size="sm" variant="outline" className="gap-1" onClick={handleCheckReminders} disabled={checkReminders.isPending}>
          <CalendarDays className="h-3 w-3" /> Check Reminders
        </Button>
      </div>

      {!vehicleId ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <ShieldCheck className="h-10 w-10 opacity-40" />
          <p>Select a vehicle to view PMCVI records</p>
        </div>
      ) : isLoading ? (
        <div className="py-12 text-center text-muted-foreground animate-pulse">Loading…</div>
      ) : records.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">No PMCVI records for this vehicle.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {(records as PmcviRecord[]).map((r) => (
            <Card key={r.id} className={`border ${r.result === "fail" ? "border-red-600/30" : r.isOfficiallyPassed ? "border-green-500/30" : "border-border"}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground">{r.inspectionDate}</span>
                      <span className="text-muted-foreground">→</span>
                      <ExpiryCountdown expiryDate={r.expiryDate} />
                      {r.isOfficiallyPassed && <Badge variant="outline" className="gap-1 text-xs text-green-400 border-green-500/40"><CheckCircle2 className="h-3 w-3" /> Officially Passed</Badge>}
                      {!r.isOfficiallyPassed && r.result === "pass" && <Badge variant="outline" className="text-xs text-amber-400 border-amber-400/40">Pass — Awaiting DriveON</Badge>}
                      {r.result === "fail" && <Badge variant="outline" className="text-xs text-red-400 border-red-400/40">Failed</Badge>}
                      {r.result === "pending" && <Badge variant="outline" className="text-xs text-muted-foreground">Pending</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                      {r.inspectionStationName && <span>Station: {r.inspectionStationName}</span>}
                      {r.inspectorName && <span>Inspector: {r.inspectorName}</span>}
                      {r.certificateNumber && <span>Cert: {r.certificateNumber}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 items-center flex-wrap">
                    {!r.driveOnDocumentKey ? (
                      <>
                        <input type="file" accept=".pdf,image/*" className="hidden" id={`driveOn-${r.id}`}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDriveOnUpload(r, f); e.target.value = ""; }} />
                        <Button size="sm" variant="outline" className="gap-1 text-xs" disabled={uploadingFor === r.id}
                          onClick={() => document.getElementById(`driveOn-${r.id}`)?.click()}>
                          <Upload className="h-3 w-3" /> {uploadingFor === r.id ? "Uploading…" : "Upload DriveON"}
                        </Button>
                      </>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-xs text-green-400 border-green-500/40"><FileText className="h-3 w-3" /> DriveON ✓</Badge>
                    )}
                    {r.driveOnDocumentKey && !r.isOfficiallyPassed && r.result !== "fail" && (
                      <Button size="sm" className="gap-1 text-xs" onClick={() => handleMarkPassed(r)} disabled={markPassed.isPending}>
                        <CheckCircle2 className="h-3 w-3" /> Mark Officially Passed
                      </Button>
                    )}
                  </div>
                </div>
                {r.repairNotes && <p className="text-xs text-muted-foreground mt-2 italic">{r.repairNotes}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add PMCVI Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add PMCVI Record</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Inspection Date *", key: "inspectionDate", type: "date" },
              { label: "Expiry Date *", key: "expiryDate", type: "date" },
              { label: "Station Name", key: "inspectionStationName", type: "text" },
              { label: "Inspector Name", key: "inspectorName", type: "text" },
              { label: "Certificate Number", key: "certificateNumber", type: "text" },
              { label: "Re-inspection Date", key: "reinspectionDate", type: "date" },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <Label className="text-xs">{label}</Label>
                <Input className="mt-1" type={type} value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              </div>
            ))}
            <div>
              <Label className="text-xs">Result</Label>
              <Select value={form.result} onValueChange={(v) => setForm({ ...form, result: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["pending", "pass", "fail", "conditional"].map((r) => <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Repair Notes</Label>
              <Textarea className="mt-1 resize-none" rows={2} value={form.repairNotes} onChange={(e) => setForm({ ...form, repairNotes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAddSubmit} disabled={createPmcvi.isPending}>{createPmcvi.isPending ? "Saving…" : "Add Record"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── (US Annual Inspection tab removed) ──────────────────────────────────────

function _UsInspectionTab_REMOVED() {
  const qc = useQueryClient();
  const [vehicleId, setVehicleId] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ inspectionDate: "", expiryDate: "", inspectorName: "", inspectorId: "", brakeInspectorName: "", brakeInspectorId: "", result: "pass", notes: "" });
  const [reportFileKey, setReportFileKey] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const createInspection = useCreateUsInspection();

  const vid = Number(vehicleId);
  const { data: records = [], isLoading } = useGetVehicleUsInspections(vid, { query: { queryKey: getGetVehicleUsInspectionsQueryKey(vid), enabled: !!vehicleId } });

  const handleReportUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const urlRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "application/pdf" }),
        credentials: "include",
      });
      const { uploadURL, objectPath } = await urlRes.json();
      await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      setReportFileKey(objectPath);
      toast.success("Report uploaded");
    } catch { toast.error("Upload failed"); }
    finally { setIsUploading(false); }
  };

  const handleSubmit = () => {
    if (!vehicleId || !form.inspectionDate || !form.expiryDate) {
      toast.error("Inspection date and expiry date are required"); return;
    }
    createInspection.mutate(
      { id: Number(vehicleId), data: { ...form, reportFileKey: reportFileKey || undefined } as any },
      {
        onSuccess: () => { toast.success("Inspection record added"); qc.invalidateQueries({ queryKey: getGetVehicleUsInspectionsQueryKey(Number(vehicleId)) }); setShowAdd(false); setReportFileKey(""); },
        onError: (e) => toast.error((e as any)?.response?.data?.error ?? "Failed"),
      }
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3 items-center">
        <VehicleSelector value={vehicleId} onChange={setVehicleId} />
        {vehicleId && <Button size="sm" className="gap-1" onClick={() => setShowAdd(true)}><Plus className="h-3 w-3" /> Add Record</Button>}
      </div>

      {!vehicleId ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <ShieldCheck className="h-10 w-10 opacity-40" />
          <p>Select a vehicle to view US annual inspection records</p>
        </div>
      ) : isLoading ? (
        <div className="py-12 text-center animate-pulse text-muted-foreground">Loading…</div>
      ) : records.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">No US annual inspection records for this vehicle.</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Inspection Date</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Countdown</TableHead>
                  <TableHead>Inspector</TableHead>
                  <TableHead>Brake Inspector</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Report</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(records as UsInspectionRecord[]).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{r.inspectionDate}</TableCell>
                    <TableCell className="text-sm">{r.expiryDate}</TableCell>
                    <TableCell><ExpiryCountdown expiryDate={r.expiryDate} /></TableCell>
                    <TableCell className="text-sm">{r.inspectorName ?? "—"}{r.inspectorId ? ` (${r.inspectorId})` : ""}</TableCell>
                    <TableCell className="text-sm">{r.brakeInspectorName ?? "—"}{r.brakeInspectorId ? ` (${r.brakeInspectorId})` : ""}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-semibold ${r.result === "pass" ? "text-green-400" : "text-red-400"}`}>
                        {r.result.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell>{r.reportFileKey ? <Badge variant="outline" className="gap-1 text-xs text-primary"><FileText className="h-3 w-3" /> On file</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add US Annual Inspection</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Inspection Date *", key: "inspectionDate", type: "date" },
              { label: "Expiry Date *", key: "expiryDate", type: "date" },
              { label: "Inspector Name", key: "inspectorName" },
              { label: "Inspector ID #", key: "inspectorId" },
              { label: "Brake Inspector Name", key: "brakeInspectorName" },
              { label: "Brake Inspector ID #", key: "brakeInspectorId" },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <Label className="text-xs">{label}</Label>
                <Input className="mt-1" type={type ?? "text"} value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              </div>
            ))}
            <div>
              <Label className="text-xs">Result</Label>
              <Select value={form.result} onValueChange={(v) => setForm({ ...form, result: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pass">Pass</SelectItem>
                  <SelectItem value="fail">Fail</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Notes</Label>
              <Textarea className="mt-1 resize-none" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Inspection Report PDF</Label>
              <div className="flex items-center gap-2 mt-1">
                <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReportUpload(f); e.target.value = ""; }} />
                <Button type="button" variant="outline" size="sm" className="gap-1" disabled={isUploading} onClick={() => fileRef.current?.click()}>
                  <Upload className="h-3 w-3" />{isUploading ? "Uploading…" : reportFileKey ? "Replace File" : "Attach Report"}
                </Button>
                {reportFileKey && <span className="text-xs text-green-400">Uploaded ✓</span>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createInspection.isPending}>{createInspection.isPending ? "Saving…" : "Add Record"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Roadside Violations tab ──────────────────────────────────────────────────

function RoadsideViolationsTab() {
  const qc = useQueryClient();
  const [vehicleId, setVehicleId] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ inspectionDate: "", inspectionLocation: "", violationCode: "", violationDescription: "", severity: "minor", correctiveAction: "" });
  const createViolation = useCreateRoadsideViolation();
  const updateViolation = useUpdateRoadsideViolation();

  const vid = Number(vehicleId);
  const { data: records = [], isLoading } = useGetVehicleRoadsideViolations(vid, { query: { queryKey: getGetVehicleRoadsideViolationsQueryKey(vid), enabled: !!vehicleId } });

  const refresh = () => qc.invalidateQueries({ queryKey: getGetVehicleRoadsideViolationsQueryKey(Number(vehicleId)) });

  const handleSubmit = () => {
    if (!vehicleId || !form.inspectionDate || !form.violationDescription) {
      toast.error("Date and description are required"); return;
    }
    createViolation.mutate(
      { id: Number(vehicleId), data: { ...form } as any },
      { onSuccess: () => { toast.success("Violation logged"); refresh(); setShowAdd(false); setForm({ inspectionDate: "", inspectionLocation: "", violationCode: "", violationDescription: "", severity: "minor", correctiveAction: "" }); },
        onError: (e) => toast.error((e as any)?.response?.data?.error ?? "Failed") }
    );
  };

  const handleResolve = (r: RoadsideViolation) => {
    updateViolation.mutate(
      { id: r.id, data: { resolved: true } },
      { onSuccess: () => { toast.success("Violation resolved"); refresh(); }, onError: (e) => toast.error((e as any)?.response?.data?.error ?? "Failed") }
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3 items-center">
        <VehicleSelector value={vehicleId} onChange={setVehicleId} />
        {vehicleId && <Button size="sm" className="gap-1" onClick={() => setShowAdd(true)}><Plus className="h-3 w-3" /> Log Violation</Button>}
      </div>

      {!vehicleId ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <ShieldCheck className="h-10 w-10 opacity-40" />
          <p>Select a vehicle to view roadside violations</p>
        </div>
      ) : isLoading ? (
        <div className="py-12 text-center animate-pulse text-muted-foreground">Loading…</div>
      ) : records.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">No roadside violations for this vehicle.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {(records as RoadsideViolation[]).map((r) => (
            <Card key={r.id} className={`border ${r.resolved ? "border-border/40 opacity-70" : r.severity === "oos" ? "border-red-600/40" : "border-orange-500/30"}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-medium">{r.inspectionDate}</span>
                      {r.inspectionLocation && <span className="text-xs text-muted-foreground">{r.inspectionLocation}</span>}
                      <span className={`text-xs font-bold ${r.severity === "oos" ? "text-red-400" : r.severity === "major" ? "text-orange-400" : "text-amber-400"}`}>
                        {r.severity?.toUpperCase()}
                      </span>
                      {r.resolved && <Badge variant="outline" className="text-xs text-green-400 border-green-500/40">Resolved</Badge>}
                    </div>
                    {r.violationCode && <p className="text-xs font-mono text-muted-foreground mb-1">Code: {r.violationCode}</p>}
                    <p className="text-sm text-foreground">{r.violationDescription}</p>
                    {r.correctiveAction && <p className="text-xs text-muted-foreground mt-1">Action: {r.correctiveAction}</p>}
                    {r.repairDocumentKey && <p className="text-xs text-green-400 mt-1"><FileText className="h-3 w-3 inline mr-1" />Repair document on file</p>}
                  </div>
                  {!r.resolved && (
                    <Button size="sm" variant="outline" className="text-xs gap-1 shrink-0" onClick={() => handleResolve(r)}>
                      <CheckCircle2 className="h-3 w-3" /> Mark Resolved
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Log Roadside Violation</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Inspection Date *</Label>
              <Input className="mt-1" type="date" value={form.inspectionDate} onChange={(e) => setForm({ ...form, inspectionDate: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Location</Label>
              <Input className="mt-1" value={form.inspectionLocation} onChange={(e) => setForm({ ...form, inspectionLocation: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Violation Code</Label>
              <Input className="mt-1 font-mono" value={form.violationCode} onChange={(e) => setForm({ ...form, violationCode: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Severity</Label>
              <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="minor">Minor</SelectItem>
                  <SelectItem value="major">Major</SelectItem>
                  <SelectItem value="oos">Out of Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Violation Description *</Label>
              <Textarea className="mt-1 resize-none" rows={2} value={form.violationDescription} onChange={(e) => setForm({ ...form, violationDescription: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Corrective Action Required</Label>
              <Textarea className="mt-1 resize-none" rows={2} value={form.correctiveAction} onChange={(e) => setForm({ ...form, correctiveAction: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createViolation.isPending}>{createViolation.isPending ? "Saving…" : "Log Violation"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function CompliancePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Compliance & Inspections</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          PMCVI records and roadside violations
        </p>
      </div>

      <Tabs defaultValue="pmcvi">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="pmcvi" className="gap-1">
            <ShieldCheck className="h-3.5 w-3.5" /> PMCVI (Ontario)
          </TabsTrigger>
          <TabsTrigger value="roadside" className="gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Roadside Violations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pmcvi" className="mt-4"><PmcviTab /></TabsContent>
        <TabsContent value="roadside" className="mt-4"><RoadsideViolationsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
