import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Check, Download, FileText, Plus, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "void";
type Invoice = {
  id: number; invoiceNumber: string; title: string; status: InvoiceStatus;
  customerId: number; customerName: string; customerCode?: string;
  contactName?: string | null; customerEmail?: string | null; customerPhone?: string | null;
  vehicleId?: number | null; vehicleUnitNumber?: string | null; vehicleDescription?: string | null;
  issueDate: string; dueDate: string; notes?: string | null; terms?: string | null;
  taxRate?: string; subtotal: string; taxAmount: string; total: string;
  amountPaid: string; paidAt?: string | null; paymentMethod?: string | null;
  sourceEstimateId?: number | null; sourceWorkOrderId?: number | null; createdAt: string;
  lineItems?: Array<{ id: number; lineType: string; description: string; quantity: string; unitPrice: string; lineTotal: string }>;
};

const statusStyle: Record<InvoiceStatus, string> = {
  draft: "bg-slate-100 text-slate-700", sent: "bg-blue-100 text-blue-800",
  paid: "bg-emerald-100 text-emerald-800", overdue: "bg-red-100 text-red-800",
  void: "bg-gray-100 text-gray-700",
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

function InvoiceList() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customerId: "", vehicleId: "", vehicleDescription: "", title: "",
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    notes: "", terms: "Please remit payment by the due date above. Thank you for your business.",
    taxRate: "13",
  });
  const { data: invoices = [], isLoading } = useQuery({ queryKey: ["invoices"], queryFn: () => api<Invoice[]>("/invoices") });
  const { data: customers = [] } = useQuery({
    queryKey: ["customers", "active"],
    queryFn: () => api<Array<{ id: number; name: string; customerCode: string; active: boolean }>>("/customers"),
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["invoice-vehicles"],
    queryFn: () => api<Array<{ id: number; unitNumber: string; year: number; make: string; model: string }>>("/vehicles"),
  });
  const create = useMutation({
    mutationFn: () => api<Invoice>("/invoices", {
      method: "POST", body: JSON.stringify({
        ...form, customerId: Number(form.customerId), vehicleId: form.vehicleId ? Number(form.vehicleId) : null,
        taxRate: Number(form.taxRate),
      }),
    }),
    onSuccess: (invoice) => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(`${invoice.invoiceNumber} created`);
      setOpen(false); navigate(`/invoices/${invoice.id}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-2xl font-bold">Invoices</h1><p className="mt-1 text-sm text-muted-foreground">Send and track professional invoices to customers.</p></div>
      <Button className="gap-2" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New invoice</Button>
    </div>
    <div className="grid gap-3 sm:grid-cols-4">
      {[
        ["Outstanding", invoices.filter((i) => ["sent", "overdue"].includes(i.status)).reduce((s, i) => s + Number(i.total) - Number(i.amountPaid), 0)],
        ["Awaiting payment", invoices.filter((i) => i.status === "sent").length],
        ["Paid", invoices.filter((i) => i.status === "paid").length],
        ["Overdue", invoices.filter((i) => i.status === "overdue").length],
      ].map(([label, value], i) => <Card key={String(label)}><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold">{i === 0 ? money(value as number) : value}</p></CardContent></Card>)}
    </div>
    <Card><CardContent className="p-0">
      {isLoading ? <div className="py-16 text-center text-muted-foreground">Loading invoices…</div> :
      invoices.length === 0 ? <div className="flex flex-col items-center py-16 text-center"><FileText className="mb-3 h-9 w-9 text-muted-foreground/40" /><p className="font-semibold">No invoices yet</p><p className="mt-1 text-sm text-muted-foreground">Create an invoice for a customer.</p></div> :
      <Table><TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Customer</TableHead><TableHead>Status</TableHead><TableHead>Due date</TableHead><TableHead className="text-right">Amount due</TableHead></TableRow></TableHeader>
      <TableBody>{invoices.map((invoice) => <TableRow key={invoice.id} className="cursor-pointer" onClick={() => navigate(`/invoices/${invoice.id}`)}>
        <TableCell><p className="font-mono text-xs font-bold text-primary">{invoice.invoiceNumber}</p><p className="mt-1 text-sm font-medium">{invoice.title}</p></TableCell>
        <TableCell className="font-medium">{invoice.customerName}</TableCell>
        <TableCell><Badge className={statusStyle[invoice.status]}>{invoice.status}</Badge></TableCell>
        <TableCell>{date(invoice.dueDate)}</TableCell>
        <TableCell className="text-right font-mono font-semibold">{money(Number(invoice.total) - Number(invoice.amountPaid))}</TableCell>
      </TableRow>)}</TableBody></Table>}
    </CardContent></Card>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>New invoice</DialogTitle></DialogHeader>
      <div className="grid gap-4 py-2 sm:grid-cols-2">
        <div className="sm:col-span-2"><Label>Customer *</Label><Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v })}><SelectTrigger className="mt-1"><SelectValue placeholder="Select a customer…" /></SelectTrigger><SelectContent>{customers.filter((c) => c.active).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name} · {c.customerCode}</SelectItem>)}</SelectContent></Select></div>
        <div className="sm:col-span-2"><Label>Invoice title *</Label><Input className="mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Service work performed October 2024" /></div>
        <div><Label>Fleet vehicle (optional)</Label><Select value={form.vehicleId || "none"} onValueChange={(v) => setForm({ ...form, vehicleId: v === "none" ? "" : v })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Outside / unregistered vehicle</SelectItem>{vehicles.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.unitNumber} — {v.year} {v.make} {v.model}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Outside vehicle description</Label><Input className="mt-1" value={form.vehicleDescription} onChange={(e) => setForm({ ...form, vehicleDescription: e.target.value })} placeholder="2021 Freightliner Cascadia" /></div>
        <div><Label>Issue date</Label><Input type="date" className="mt-1" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} /></div>
        <div><Label>Due date</Label><Input type="date" className="mt-1" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
        <div><Label>Tax rate (%)</Label><Input type="number" min="0" max="100" step="0.001" className="mt-1" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} /></div>
        <div className="sm:col-span-2" />
        <div className="sm:col-span-2"><Label>Notes</Label><Textarea className="mt-1" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Invoice notes or special instructions…" /></div>
        <div className="sm:col-span-2"><Label>Terms</Label><Textarea className="mt-1" rows={2} value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} /></div>
      </div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!form.customerId || !form.title.trim() || create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Creating…" : "Create invoice"}</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}

function InvoiceDetail({ id }: { id: number }) {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [lineOpen, setLineOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [line, setLine] = useState({ lineType: "service", description: "", quantity: "1", unitPrice: "" });
  const [payment, setPayment] = useState({ paymentMethod: "" });
  const key = ["invoice", id];
  const { data: invoice, isLoading } = useQuery({ queryKey: key, queryFn: () => api<Invoice>(`/invoices/${id}`) });
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["invoices"] }); };
  const addLine = useMutation({
    mutationFn: () => api(`/invoices/${id}/line-items`, { method: "POST", body: JSON.stringify({ ...line, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice) }) }),
    onSuccess: () => { refresh(); setLineOpen(false); setLine({ lineType: "service", description: "", quantity: "1", unitPrice: "" }); toast.success("Line item added"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeLine = useMutation({
    mutationFn: (lineId: number) => api(`/invoices/${id}/line-items/${lineId}`, { method: "DELETE" }),
    onSuccess: () => { refresh(); toast.success("Line item removed"); }, onError: (e: Error) => toast.error(e.message),
  });
  const setStatus = useMutation({
    mutationFn: (status: string) => api(`/invoices/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, paymentMethod: status === "paid" ? payment.paymentMethod : undefined }) }),
    onSuccess: () => { refresh(); toast.success("Invoice status updated"); setPaymentOpen(false); }, onError: (e: Error) => toast.error(e.message),
  });
  const download = async () => {
    try {
      const res = await fetch(`/api/invoices/${id}/pdf`, { credentials: "include" });
      if (!res.ok) throw new Error("Unable to create PDF");
      const url = URL.createObjectURL(await res.blob()); const a = document.createElement("a");
      a.href = url; a.download = `${invoice?.invoiceNumber ?? "invoice"}.pdf`; a.click(); URL.revokeObjectURL(url);
    } catch (e: any) { toast.error(e.message); }
  };
  if (isLoading || !invoice) return <div className="py-16 text-center text-muted-foreground">Loading invoice…</div>;
  const editable = invoice.status === "draft";
  const amountDue = Number(invoice.total) - Number(invoice.amountPaid);
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-3"><Button variant="ghost" size="icon" onClick={() => navigate("/invoices")}><ArrowLeft className="h-4 w-4" /></Button><div><div className="flex items-center gap-2"><h1 className="font-mono text-2xl font-bold">{invoice.invoiceNumber}</h1><Badge className={statusStyle[invoice.status]}>{invoice.status}</Badge></div><p className="mt-1 text-muted-foreground">{invoice.title}</p></div></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" className="gap-2" onClick={download}><Download className="h-4 w-4" /> Download PDF</Button>
      {invoice.status === "draft" && <Button className="gap-2" disabled={setStatus.isPending} onClick={() => setStatus.mutate("sent")}><Send className="h-4 w-4" /> Mark as sent</Button>}
      {["sent", "overdue"].includes(invoice.status) && <Button className="gap-2" disabled={setStatus.isPending} onClick={() => setPaymentOpen(true)}><Check className="h-4 w-4" /> Mark as paid</Button>}
      {invoice.status !== "void" && <Button variant="outline" onClick={() => setStatus.mutate("void")}>Mark void</Button>}</div>
    </div>
    <div className="grid gap-4 md:grid-cols-3"><Card><CardHeader><CardTitle className="text-sm">Customer</CardTitle></CardHeader><CardContent><p className="font-semibold">{invoice.customerName}</p><p className="mt-1 text-sm text-muted-foreground">{invoice.contactName ?? invoice.customerEmail ?? "No contact listed"}</p></CardContent></Card><Card><CardHeader><CardTitle className="text-sm">Dates</CardTitle></CardHeader><CardContent><p className="font-semibold">Due {date(invoice.dueDate)}</p><p className="mt-1 text-sm text-muted-foreground">Issued {date(invoice.issueDate)}</p></CardContent></Card><Card><CardHeader><CardTitle className="text-sm">Amount due</CardTitle></CardHeader><CardContent><p className="font-semibold text-lg">{money(amountDue)}</p><p className="mt-1 text-sm text-muted-foreground">{amountDue === 0 ? "Paid in full" : `of ${money(invoice.total)}`}</p></CardContent></Card></div>
    <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle>Invoice items</CardTitle>{editable && <Button size="sm" className="gap-2" onClick={() => setLineOpen(true)}><Plus className="h-4 w-4" /> Add item</Button>}</CardHeader><CardContent className="p-0">
      <Table><TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead className="text-right">Unit Price</TableHead><TableHead className="text-right">Amount</TableHead>{editable && <TableHead className="w-12" />}</TableRow></TableHeader><TableBody>
        {(invoice.lineItems ?? []).map((item) => <TableRow key={item.id}><TableCell className="capitalize">{item.lineType}</TableCell><TableCell className="font-medium">{item.description}</TableCell><TableCell className="text-right font-mono">{Number(item.quantity)}</TableCell><TableCell className="text-right font-mono">{money(item.unitPrice)}</TableCell><TableCell className="text-right font-mono font-semibold">{money(item.lineTotal)}</TableCell>{editable && <TableCell><Button variant="ghost" size="icon" onClick={() => removeLine.mutate(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>}</TableRow>)}
        {(invoice.lineItems ?? []).length === 0 && <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Add services, labour, parts, or fees to build this invoice.</TableCell></TableRow>}
      </TableBody></Table>
      <div className="ml-auto w-full max-w-sm space-y-3 border-t p-6"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{money(invoice.subtotal)}</span></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Tax ({Number(invoice.taxRate ?? 0).toFixed(2)}%)</span><span className="font-mono">{money(invoice.taxAmount)}</span></div><div className="flex justify-between border-t pt-3 text-lg font-bold"><span>Total</span><span className="font-mono">{money(invoice.total)}</span></div>{Number(invoice.amountPaid) > 0 && <div className="space-y-1 border-t pt-3"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Amount paid</span><span className="font-mono">{money(invoice.amountPaid)}</span></div><div className="flex justify-between border-t pt-2 font-semibold"><span>Amount due</span><span className="font-mono">{money(amountDue)}</span></div></div>}</div>
    </CardContent></Card>
    {(invoice.notes || invoice.terms) && <div className="grid gap-4 md:grid-cols-2">{invoice.notes && <Card><CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader><CardContent className="whitespace-pre-wrap text-sm">{invoice.notes}</CardContent></Card>}{invoice.terms && <Card><CardHeader><CardTitle className="text-sm">Terms</CardTitle></CardHeader><CardContent className="whitespace-pre-wrap text-sm">{invoice.terms}</CardContent></Card>}</div>}
    <Dialog open={lineOpen} onOpenChange={setLineOpen}><DialogContent><DialogHeader><DialogTitle>Add invoice item</DialogTitle></DialogHeader><div className="space-y-4 py-2"><div><Label>Type</Label><Select value={line.lineType} onValueChange={(v) => setLine({ ...line, lineType: v })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{["service", "labour", "part", "fee"].map((v) => <SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>)}</SelectContent></Select></div><div><Label>Description *</Label><Textarea className="mt-1" value={line.description} onChange={(e) => setLine({ ...line, description: e.target.value })} /></div><div className="grid grid-cols-2 gap-4"><div><Label>Quantity</Label><Input type="number" min="0.01" step="0.01" className="mt-1" value={line.quantity} onChange={(e) => setLine({ ...line, quantity: e.target.value })} /></div><div><Label>Unit price</Label><Input type="number" min="0" step="0.01" className="mt-1" value={line.unitPrice} onChange={(e) => setLine({ ...line, unitPrice: e.target.value })} /></div></div></div><DialogFooter><Button variant="outline" onClick={() => setLineOpen(false)}>Cancel</Button><Button disabled={!line.description.trim() || !line.unitPrice || addLine.isPending} onClick={() => addLine.mutate()}>{addLine.isPending ? "Adding…" : "Add item"}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}><DialogContent><DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader><div className="space-y-4 py-4"><div className="bg-slate-50 p-4 rounded"><p className="text-sm text-muted-foreground">Amount due</p><p className="text-2xl font-bold">{money(amountDue)}</p></div><div><Label>Payment method *</Label><Input className="mt-2" value={payment.paymentMethod} onChange={(e) => setPayment({ ...payment, paymentMethod: e.target.value })} placeholder="e.g., Check #123, ACH, Credit Card…" /></div></div><DialogFooter><Button variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button><Button disabled={!payment.paymentMethod.trim() || setStatus.isPending} onClick={() => setStatus.mutate("paid")}>{setStatus.isPending ? "Recording…" : "Record payment"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

export default function InvoicesPage({ id }: { id?: number }) {
  return id ? <InvoiceDetail id={id} /> : <InvoiceList />;
}
