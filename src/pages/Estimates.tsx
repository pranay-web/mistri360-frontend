import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Check, Download, FileText, Plus, Send, Trash2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type EstimateStatus = "draft" | "sent" | "approved" | "declined" | "expired" | "converted";
type Estimate = {
  id: number; estimateNumber: string; title: string; status: EstimateStatus;
  customerId: number; customerName: string; customerCode?: string;
  contactName?: string | null; customerEmail?: string | null; customerPhone?: string | null;
  vehicleId?: number | null; vehicleUnitNumber?: string | null; vehicleDescription?: string | null;
  validUntil?: string | null; notes?: string | null; terms?: string | null;
  taxRate?: string; subtotal: string; taxAmount: string; total: string;
  convertedWorkOrderId?: number | null; createdAt: string;
  lineItems?: Array<{ id: number; lineType: string; description: string; quantity: string; unitPrice: string; lineTotal: string }>;
};

const statusStyle: Record<EstimateStatus, string> = {
  draft: "bg-slate-100 text-slate-700", sent: "bg-blue-100 text-blue-800",
  approved: "bg-emerald-100 text-emerald-800", declined: "bg-red-100 text-red-800",
  expired: "bg-amber-100 text-amber-800", converted: "bg-violet-100 text-violet-800",
};
const money = (value: string | number) => Number(value).toLocaleString("en-CA", { style: "currency", currency: "CAD" });
const date = (value?: string | null) => value ? new Date(value).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" }) : "—";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init, credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Request failed");
  }
  return response.json();
}

function EstimateList() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customerId: "", vehicleId: "", vehicleDescription: "", title: "",
    validUntil: "", notes: "", terms: "Estimate valid until the date shown. Additional work requires customer approval.",
    taxRate: "13",
  });
  const { data: estimates = [], isLoading } = useQuery({ queryKey: ["estimates"], queryFn: () => api<Estimate[]>("/estimates") });
  const { data: customers = [] } = useQuery({
    queryKey: ["customers", "active"],
    queryFn: () => api<Array<{ id: number; name: string; customerCode: string; active: boolean }>>("/customers"),
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["estimate-vehicles"],
    queryFn: () => api<Array<{ id: number; unitNumber: string; year: number; make: string; model: string }>>("/vehicles"),
  });
  const create = useMutation({
    mutationFn: () => api<Estimate>("/estimates", {
      method: "POST", body: JSON.stringify({
        ...form, customerId: Number(form.customerId), vehicleId: form.vehicleId ? Number(form.vehicleId) : null,
        taxRate: Number(form.taxRate), validUntil: form.validUntil || null,
      }),
    }),
    onSuccess: (estimate) => {
      qc.invalidateQueries({ queryKey: ["estimates"] });
      toast.success(`${estimate.estimateNumber} created`);
      setOpen(false); navigate(`/estimates/${estimate.id}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-2xl font-bold">Estimates</h1><p className="mt-1 text-sm text-muted-foreground">Prepare professional quotes for outside customer work.</p></div>
      <Button className="gap-2" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New estimate</Button>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        ["Open value", estimates.filter((e) => ["draft", "sent"].includes(e.status)).reduce((s, e) => s + Number(e.total), 0)],
        ["Awaiting approval", estimates.filter((e) => e.status === "sent").length],
        ["Approved / converted", estimates.filter((e) => ["approved", "converted"].includes(e.status)).length],
      ].map(([label, value], i) => <Card key={String(label)}><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold">{i === 0 ? money(value as number) : value}</p></CardContent></Card>)}
    </div>
    <Card><CardContent className="p-0">
      {isLoading ? <div className="py-16 text-center text-muted-foreground">Loading estimates…</div> :
      estimates.length === 0 ? <div className="flex flex-col items-center py-16 text-center"><FileText className="mb-3 h-9 w-9 text-muted-foreground/40" /><p className="font-semibold">No estimates yet</p><p className="mt-1 text-sm text-muted-foreground">Create an estimate for an outside customer.</p></div> :
      <Table><TableHeader><TableRow><TableHead>Estimate</TableHead><TableHead>Customer</TableHead><TableHead>Vehicle</TableHead><TableHead>Status</TableHead><TableHead>Valid Until</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
      <TableBody>{estimates.map((estimate) => <TableRow key={estimate.id} className="cursor-pointer" onClick={() => navigate(`/estimates/${estimate.id}`)}>
        <TableCell><p className="font-mono text-xs font-bold text-primary">{estimate.estimateNumber}</p><p className="mt-1 text-sm font-medium">{estimate.title}</p></TableCell>
        <TableCell className="font-medium">{estimate.customerName}</TableCell>
        <TableCell>{estimate.vehicleUnitNumber ?? estimate.vehicleDescription ?? "Customer vehicle"}</TableCell>
        <TableCell><Badge className={statusStyle[estimate.status]}>{estimate.status.replace(/_/g, " ")}</Badge></TableCell>
        <TableCell>{date(estimate.validUntil)}</TableCell><TableCell className="text-right font-mono font-semibold">{money(estimate.total)}</TableCell>
      </TableRow>)}</TableBody></Table>}
    </CardContent></Card>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>New customer estimate</DialogTitle></DialogHeader>
      <div className="grid gap-4 py-2 sm:grid-cols-2">
        <div className="sm:col-span-2"><Label>Customer *</Label><Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v })}><SelectTrigger className="mt-1"><SelectValue placeholder="Select an outside customer…" /></SelectTrigger><SelectContent>{customers.filter((c) => c.active).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name} · {c.customerCode}</SelectItem>)}</SelectContent></Select></div>
        <div className="sm:col-span-2"><Label>Estimate title *</Label><Input className="mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Annual inspection and brake service" /></div>
        <div><Label>Fleet vehicle (optional)</Label><Select value={form.vehicleId || "none"} onValueChange={(v) => setForm({ ...form, vehicleId: v === "none" ? "" : v })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Outside / unregistered vehicle</SelectItem>{vehicles.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.unitNumber} — {v.year} {v.make} {v.model}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Outside vehicle description</Label><Input className="mt-1" value={form.vehicleDescription} onChange={(e) => setForm({ ...form, vehicleDescription: e.target.value })} placeholder="2021 Freightliner Cascadia, VIN…" /></div>
        <div><Label>Valid until</Label><Input type="date" className="mt-1" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} /></div>
        <div><Label>Tax rate (%)</Label><Input type="number" min="0" max="100" step="0.001" className="mt-1" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} /></div>
        <div className="sm:col-span-2"><Label>Scope notes</Label><Textarea className="mt-1" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <div className="sm:col-span-2"><Label>Terms</Label><Textarea className="mt-1" rows={2} value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} /></div>
      </div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!form.customerId || !form.title.trim() || create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Creating…" : "Create estimate"}</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}

function EstimateDetail({ id }: { id: number }) {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [lineOpen, setLineOpen] = useState(false);
  const [line, setLine] = useState({ lineType: "service", description: "", quantity: "1", unitPrice: "" });
  const key = ["estimate", id];
  const { data: estimate, isLoading } = useQuery({ queryKey: key, queryFn: () => api<Estimate>(`/estimates/${id}`) });
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["estimates"] }); };
  const addLine = useMutation({
    mutationFn: () => api(`/estimates/${id}/line-items`, { method: "POST", body: JSON.stringify({ ...line, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice) }) }),
    onSuccess: () => { refresh(); setLineOpen(false); setLine({ lineType: "service", description: "", quantity: "1", unitPrice: "" }); toast.success("Line item added"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeLine = useMutation({
    mutationFn: (lineId: number) => api(`/estimates/${id}/line-items/${lineId}`, { method: "DELETE" }),
    onSuccess: () => { refresh(); toast.success("Line item removed"); }, onError: (e: Error) => toast.error(e.message),
  });
  const setStatus = useMutation({
    mutationFn: (status: string) => api(`/estimates/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => { refresh(); toast.success("Estimate status updated"); }, onError: (e: Error) => toast.error(e.message),
  });
  const convert = useMutation({
    mutationFn: () => api<{ id: number; woNumber: string }>(`/estimates/${id}/convert`, { method: "POST" }),
    onSuccess: (wo) => { refresh(); toast.success(`Converted to ${wo.woNumber}`); navigate(`/work-orders/${wo.id}`); },
    onError: (e: Error) => toast.error(e.message),
  });
  const download = async () => {
    try {
      const res = await fetch(`/api/estimates/${id}/pdf`, { credentials: "include" });
      if (!res.ok) throw new Error("Unable to create PDF");
      const url = URL.createObjectURL(await res.blob()); const a = document.createElement("a");
      a.href = url; a.download = `${estimate?.estimateNumber ?? "estimate"}.pdf`; a.click(); URL.revokeObjectURL(url);
    } catch (e: any) { toast.error(e.message); }
  };
  if (isLoading || !estimate) return <div className="py-16 text-center text-muted-foreground">Loading estimate…</div>;
  const editable = estimate.status === "draft";
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-3"><Button variant="ghost" size="icon" onClick={() => navigate("/estimates")}><ArrowLeft className="h-4 w-4" /></Button><div><div className="flex items-center gap-2"><h1 className="font-mono text-2xl font-bold">{estimate.estimateNumber}</h1><Badge className={statusStyle[estimate.status]}>{estimate.status}</Badge></div><p className="mt-1 text-muted-foreground">{estimate.title}</p></div></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" className="gap-2" onClick={download}><Download className="h-4 w-4" /> Download PDF</Button>
      {estimate.status === "draft" && <Button className="gap-2" disabled={setStatus.isPending} onClick={() => setStatus.mutate("sent")}><Send className="h-4 w-4" /> Mark as sent</Button>}
      {estimate.status === "sent" && <><Button variant="outline" onClick={() => setStatus.mutate("declined")}>Declined</Button><Button className="gap-2" onClick={() => setStatus.mutate("approved")}><Check className="h-4 w-4" /> Approve</Button></>}
      {estimate.status === "approved" && <Button className="gap-2" disabled={convert.isPending || !estimate.vehicleId} onClick={() => convert.mutate()} title={!estimate.vehicleId ? "Select a fleet vehicle before conversion" : undefined}><Wrench className="h-4 w-4" /> Convert to work order</Button>}
      {estimate.status === "converted" && estimate.convertedWorkOrderId && <Button onClick={() => navigate(`/work-orders/${estimate.convertedWorkOrderId}`)}>View work order</Button>}</div>
    </div>
    <div className="grid gap-4 md:grid-cols-3"><Card><CardHeader><CardTitle className="text-sm">Customer</CardTitle></CardHeader><CardContent><p className="font-semibold">{estimate.customerName}</p><p className="mt-1 text-sm text-muted-foreground">{estimate.contactName ?? estimate.customerEmail ?? "No contact listed"}</p></CardContent></Card><Card><CardHeader><CardTitle className="text-sm">Vehicle</CardTitle></CardHeader><CardContent><p className="font-semibold">{estimate.vehicleUnitNumber ?? estimate.vehicleDescription ?? "Customer vehicle"}</p><p className="mt-1 text-sm text-muted-foreground">{estimate.vehicleId ? "Registered fleet vehicle" : "Outside vehicle"}</p></CardContent></Card><Card><CardHeader><CardTitle className="text-sm">Estimate terms</CardTitle></CardHeader><CardContent><p className="font-semibold">Valid until {date(estimate.validUntil)}</p><p className="mt-1 text-sm text-muted-foreground">{Number(estimate.taxRate ?? 0).toFixed(2)}% tax</p></CardContent></Card></div>
    <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle>Estimate items</CardTitle>{editable && <Button size="sm" className="gap-2" onClick={() => setLineOpen(true)}><Plus className="h-4 w-4" /> Add item</Button>}</CardHeader><CardContent className="p-0">
      <Table><TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead className="text-right">Unit Price</TableHead><TableHead className="text-right">Amount</TableHead>{editable && <TableHead className="w-12" />}</TableRow></TableHeader><TableBody>
        {(estimate.lineItems ?? []).map((item) => <TableRow key={item.id}><TableCell className="capitalize">{item.lineType}</TableCell><TableCell className="font-medium">{item.description}</TableCell><TableCell className="text-right font-mono">{Number(item.quantity)}</TableCell><TableCell className="text-right font-mono">{money(item.unitPrice)}</TableCell><TableCell className="text-right font-mono font-semibold">{money(item.lineTotal)}</TableCell>{editable && <TableCell><Button variant="ghost" size="icon" onClick={() => removeLine.mutate(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>}</TableRow>)}
        {(estimate.lineItems ?? []).length === 0 && <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Add services, labour, parts, or fees to build this estimate.</TableCell></TableRow>}
      </TableBody></Table>
      <div className="ml-auto w-full max-w-sm space-y-3 border-t p-6"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{money(estimate.subtotal)}</span></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Tax ({Number(estimate.taxRate ?? 0).toFixed(2)}%)</span><span className="font-mono">{money(estimate.taxAmount)}</span></div><div className="flex justify-between border-t pt-3 text-lg font-bold"><span>Total</span><span className="font-mono">{money(estimate.total)}</span></div></div>
    </CardContent></Card>
    {(estimate.notes || estimate.terms) && <div className="grid gap-4 md:grid-cols-2">{estimate.notes && <Card><CardHeader><CardTitle className="text-sm">Scope notes</CardTitle></CardHeader><CardContent className="whitespace-pre-wrap text-sm">{estimate.notes}</CardContent></Card>}{estimate.terms && <Card><CardHeader><CardTitle className="text-sm">Terms</CardTitle></CardHeader><CardContent className="whitespace-pre-wrap text-sm">{estimate.terms}</CardContent></Card>}</div>}
    <Dialog open={lineOpen} onOpenChange={setLineOpen}><DialogContent><DialogHeader><DialogTitle>Add estimate item</DialogTitle></DialogHeader><div className="space-y-4 py-2"><div><Label>Type</Label><Select value={line.lineType} onValueChange={(v) => setLine({ ...line, lineType: v })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{["service", "labour", "part", "fee"].map((v) => <SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>)}</SelectContent></Select></div><div><Label>Description *</Label><Textarea className="mt-1" value={line.description} onChange={(e) => setLine({ ...line, description: e.target.value })} /></div><div className="grid grid-cols-2 gap-4"><div><Label>Quantity</Label><Input type="number" min="0.01" step="0.01" className="mt-1" value={line.quantity} onChange={(e) => setLine({ ...line, quantity: e.target.value })} /></div><div><Label>Unit price</Label><Input type="number" min="0" step="0.01" className="mt-1" value={line.unitPrice} onChange={(e) => setLine({ ...line, unitPrice: e.target.value })} /></div></div></div><DialogFooter><Button variant="outline" onClick={() => setLineOpen(false)}>Cancel</Button><Button disabled={!line.description.trim() || !line.unitPrice || addLine.isPending} onClick={() => addLine.mutate()}>{addLine.isPending ? "Adding…" : "Add item"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

export default function EstimatesPage({ id }: { id?: number }) {
  return id ? <EstimateDetail id={id} /> : <EstimateList />;
}