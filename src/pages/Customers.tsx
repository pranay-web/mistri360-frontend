import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, Pencil, Building2, Mail, Phone, Wrench } from "lucide-react";
import { toast } from "sonner";

type Customer = {
  id: number;
  customerCode: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  notes: string | null;
  active: boolean;
  workOrderCount: number;
};

type CustomerForm = Omit<Customer, "id" | "workOrderCount">;
const EMPTY_FORM: CustomerForm = {
  customerCode: "",
  name: "",
  contactName: "",
  email: "",
  phone: "",
  addressLine1: "",
  city: "",
  province: "ON",
  postalCode: "",
  notes: "",
  active: true,
};

async function customerRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Customer request failed");
  }
  return res.json();
}

export default function CustomersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: () => customerRequest<Customer[]>("/api/customers"),
  });

  const saveCustomer = useMutation({
    mutationFn: () => customerRequest<Customer>(
      editing ? `/api/customers/${editing.id}` : "/api/customers",
      { method: editing ? "PATCH" : "POST", body: JSON.stringify(form) }
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success(editing ? "Customer updated" : "Customer added");
      setDialogOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleActive = useMutation({
    mutationFn: (customer: Customer) => customerRequest<Customer>(`/api/customers/${customer.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !customer.active }),
    }),
    onSuccess: (_, customer) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success(customer.active ? "Customer marked inactive" : "Customer reactivated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };
  const openEdit = (customer: Customer) => {
    setEditing(customer);
    setForm({
      customerCode: customer.customerCode,
      name: customer.name,
      contactName: customer.contactName ?? "",
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      addressLine1: customer.addressLine1 ?? "",
      city: customer.city ?? "",
      province: customer.province ?? "",
      postalCode: customer.postalCode ?? "",
      notes: customer.notes ?? "",
      active: customer.active,
    });
    setDialogOpen(true);
  };

  const filtered = customers.filter((customer) => {
    const q = search.toLowerCase();
    return !q || [customer.name, customer.customerCode, customer.contactName, customer.email]
      .some((value) => value?.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">Customer contacts and work-order assignments.</p>
        </div>
        <Button onClick={openNew} className="gap-2" data-testid="button-add-customer">
          <Plus className="h-4 w-4" /> Add customer
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers…" className="pl-9" />
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading customers…</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-16 text-center">
          <Building2 className="mb-3 h-9 w-9 text-muted-foreground/40" />
          <p className="font-semibold">{search ? "No matching customers" : "No customers yet"}</p>
          <p className="mt-1 text-sm text-muted-foreground">Add a customer to assign them to future work orders.</p>
          {!search && <Button className="mt-4" variant="outline" onClick={openNew}>Add first customer</Button>}
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((customer) => (
            <Card key={customer.id} className={!customer.active ? "opacity-65" : ""}>
              <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-base font-semibold">{customer.name}</h2>
                    <Badge variant="outline" className="font-mono text-[10px]">{customer.customerCode}</Badge>
                    <Badge variant={customer.active ? "secondary" : "outline"}>{customer.active ? "Active" : "Inactive"}</Badge>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                    {customer.contactName && <span>{customer.contactName}</span>}
                    {customer.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{customer.email}</span>}
                    {customer.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{customer.phone}</span>}
                    <span className="flex items-center gap-1"><Wrench className="h-3 w-3" />{Number(customer.workOrderCount)} work orders</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(customer)} className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleActive.mutate(customer)} disabled={toggleActive.isPending}>
                    {customer.active ? "Deactivate" : "Reactivate"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Edit customer" : "Add customer"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div><Label>Customer code *</Label><Input className="mt-1" value={form.customerCode} onChange={(e) => setForm({ ...form, customerCode: e.target.value.toUpperCase() })} placeholder="ACME" /></div>
            <div><Label>Company name *</Label><Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Contact name</Label><Input className="mt-1" value={form.contactName ?? ""} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" className="mt-1" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Phone</Label><Input className="mt-1" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Street address</Label><Input className="mt-1" value={form.addressLine1 ?? ""} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} /></div>
            <div><Label>City</Label><Input className="mt-1" value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Province</Label><Input className="mt-1" value={form.province ?? ""} onChange={(e) => setForm({ ...form, province: e.target.value })} /></div>
              <div><Label>Postal code</Label><Input className="mt-1" value={form.postalCode ?? ""} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} /></div>
            </div>
            <div className="sm:col-span-2"><Label>Notes</Label><Textarea className="mt-1" rows={3} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveCustomer.mutate()} disabled={!form.name.trim() || !form.customerCode.trim() || saveCustomer.isPending}>
              {saveCustomer.isPending ? "Saving…" : editing ? "Save changes" : "Add customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}