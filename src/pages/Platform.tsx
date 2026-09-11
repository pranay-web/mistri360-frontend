import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Loader2, Plus, Power, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mistri360Mark } from "@/components/layout/Mistri360Mark";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";

type Company = { id: number; name: string; slug: string; active: boolean; createdAt: string };
type CompanyUser = { id: number; name: string; email: string; role: string; phone?: string };
const companySchema = z.object({ name: z.string().min(2, "Company name is required"), slug: z.string().regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens"), adminName: z.string().min(2, "Administrator name is required"), adminEmail: z.string().email(), adminPassword: z.string().min(8, "Password must be at least 8 characters") });
const userSchema = z.object({ name: z.string().min(2, "Name is required"), email: z.string().email(), password: z.string().min(8, "Password must be at least 8 characters"), role: z.enum(["admin", "manager", "mechanic", "driver"]), phone: z.string().optional() });
type CompanyValues = z.infer<typeof companySchema>;
type UserValues = z.infer<typeof userSchema>;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json", ...(init?.headers || {}) }, ...init });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || body?.message || "Request failed. Please try again.");
  }
  return response.json();
}

function FieldError({ message }: { message?: string }) { return message ? <p className="text-xs text-destructive">{message}</p> : null; }

export default function Platform() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Company | null>(null);
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userDialog, setUserDialog] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const logout = useLogout();
  const companyForm = useForm<CompanyValues>({ resolver: zodResolver(companySchema), defaultValues: { name: "", slug: "", adminName: "", adminEmail: "", adminPassword: "" } });
  const userForm = useForm<UserValues>({ resolver: zodResolver(userSchema), defaultValues: { name: "", email: "", password: "", role: "manager", phone: "" } });

  const loadCompanies = async () => {
    setLoading(true); setError("");
    try { setCompanies(await api<Company[]>("/api/platform/companies")); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load company accounts."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadCompanies(); }, []);

  const openUsers = async (company: Company) => {
    setSelected(company); setUsersLoading(true); setUsers([]);
    try { setUsers(await api<CompanyUser[]>(`/api/platform/companies/${company.id}/users`)); }
    catch (e) { toast({ variant: "destructive", title: "Unable to load users", description: e instanceof Error ? e.message : undefined }); }
    finally { setUsersLoading(false); }
  };
  const createCompany = async (values: CompanyValues) => {
    try {
      await api("/api/platform/companies", { method: "POST", body: JSON.stringify(values) });
      toast({ title: "Company account created", description: "The first administrator can now sign in." });
      companyForm.reset(); setCreating(false); void loadCompanies();
    } catch (e) { toast({ variant: "destructive", title: "Could not create company", description: e instanceof Error ? e.message : undefined }); }
  };
  const toggleCompany = async (company: Company, active: boolean) => {
    try {
      await api(`/api/platform/companies/${company.id}`, { method: "PATCH", body: JSON.stringify({ active }) });
      setCompanies((current) => current.map((item) => item.id === company.id ? { ...item, active } : item));
      if (selected?.id === company.id) setSelected({ ...selected, active });
      toast({ title: active ? "Company activated" : "Company deactivated", description: `${company.name} has been ${active ? "restored" : "disabled"}.` });
    } catch (e) { toast({ variant: "destructive", title: "Status update failed", description: e instanceof Error ? e.message : undefined }); }
  };
  const createUser = async (values: UserValues) => {
    if (!selected) return;
    try {
      const body = { ...values, phone: values.phone || undefined };
      await api(`/api/platform/companies/${selected.id}/users`, { method: "POST", body: JSON.stringify(body) });
      toast({ title: "User added", description: "The new account is ready to sign in." });
      userForm.reset(); setUserDialog(false); void openUsers(selected);
    } catch (e) { toast({ variant: "destructive", title: "Could not add user", description: e instanceof Error ? e.message : undefined }); }
  };
  const signOut = () => logout.mutate(undefined, { onSuccess: () => { queryClient.removeQueries({ queryKey: getGetMeQueryKey() }); setLocation("/platform-login"); } });

  return <div className="min-h-[100dvh] bg-background">
    <header className="border-b bg-card px-5 py-4 md:px-8"><div className="mx-auto flex max-w-7xl items-center justify-between">
      <Mistri360Mark />
      <div className="flex items-center gap-3"><span className="hidden text-sm font-medium text-muted-foreground sm:block">Platform administration</span><Button variant="outline" size="sm" onClick={signOut} data-testid="button-platform-logout">Sign out</Button></div>
    </div></header>
    <main className="mx-auto max-w-7xl p-5 md:p-8">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-primary">Platform console</p><h1 className="text-3xl text-foreground">Company accounts</h1><p className="mt-2 text-sm text-muted-foreground">Create and manage mistri360 customer workspaces and their access.</p></div><Button onClick={() => setCreating(true)} data-testid="button-create-company"><Plus className="mr-2 h-4 w-4" />New company</Button></div>
      {loading ? <div className="flex justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : error ? <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6"><p className="font-semibold">Unable to load companies</p><p className="mt-1 text-sm text-muted-foreground">{error}</p><Button className="mt-4" variant="outline" onClick={() => void loadCompanies()} data-testid="button-retry-companies">Try again</Button></div> : companies.length === 0 ? <div className="rounded-xl border border-dashed p-12 text-center"><Building2 className="mx-auto h-9 w-9 text-muted-foreground" /><h2 className="mt-4 text-xl">No company accounts yet</h2><p className="mt-1 text-sm text-muted-foreground">Create the first workspace to get started.</p></div> :
      <div className="overflow-hidden rounded-xl border bg-card"><div className="hidden grid-cols-[1.5fr_1fr_.8fr_1fr] gap-4 border-b bg-muted/40 px-5 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground md:grid"><span>Company</span><span>Workspace slug</span><span>Status</span><span>Actions</span></div>{companies.map((company) => <div key={company.id} className="grid gap-3 border-b px-5 py-4 last:border-0 md:grid-cols-[1.5fr_1fr_.8fr_1fr] md:items-center"><div><p className="font-semibold" data-testid={`text-company-${company.id}`}>{company.name}</p><p className="text-xs text-muted-foreground md:hidden">/{company.slug}</p></div><span className="hidden font-mono text-sm text-muted-foreground md:block">/{company.slug}</span><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${company.active ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`} data-testid={`status-company-${company.id}`}>{company.active ? "Active" : "Inactive"}</span><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void openUsers(company)} data-testid={`button-view-users-${company.id}`}><Users className="mr-1.5 h-3.5 w-3.5" />Users</Button><Button variant="ghost" size="sm" onClick={() => void toggleCompany(company, !company.active)} data-testid={`button-toggle-company-${company.id}`}><Power className="mr-1.5 h-3.5 w-3.5" />{company.active ? "Deactivate" : "Activate"}</Button></div></div>)}</div>}
    </main>
    <Dialog open={creating} onOpenChange={setCreating}><DialogContent><DialogHeader><DialogTitle>Create company workspace</DialogTitle><DialogDescription>Create the company and its initial administrator in one step.</DialogDescription></DialogHeader><form onSubmit={companyForm.handleSubmit(createCompany)} className="space-y-4"><div><Label htmlFor="company-name">Company name</Label><Input id="company-name" data-testid="input-company-name" {...companyForm.register("name")} /><FieldError message={companyForm.formState.errors.name?.message} /></div><div><Label htmlFor="company-slug">Workspace slug</Label><Input id="company-slug" placeholder="acme-logistics" data-testid="input-company-slug" {...companyForm.register("slug")} /><FieldError message={companyForm.formState.errors.slug?.message} /></div><div><Label htmlFor="admin-name">First administrator name</Label><Input id="admin-name" data-testid="input-admin-name" {...companyForm.register("adminName")} /><FieldError message={companyForm.formState.errors.adminName?.message} /></div><div><Label htmlFor="admin-email">First administrator email</Label><Input id="admin-email" type="email" data-testid="input-admin-email" {...companyForm.register("adminEmail")} /><FieldError message={companyForm.formState.errors.adminEmail?.message} /></div><div><Label htmlFor="admin-password">Temporary password</Label><Input id="admin-password" type="password" data-testid="input-admin-password" {...companyForm.register("adminPassword")} /><FieldError message={companyForm.formState.errors.adminPassword?.message} /></div><Button className="w-full" type="submit" disabled={companyForm.formState.isSubmitting} data-testid="button-submit-company">{companyForm.formState.isSubmitting ? "Creating…" : "Create company"}</Button></form></DialogContent></Dialog>
    <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{selected?.name} users</DialogTitle><DialogDescription>Manage user accounts for this company workspace.</DialogDescription></DialogHeader>{selected && <><div className="flex items-center justify-between rounded-lg bg-muted/50 p-3"><div><p className="text-sm font-medium">{selected.active ? "Workspace active" : "Workspace inactive"}</p><p className="text-xs text-muted-foreground">/{selected.slug}</p></div><Switch checked={selected.active} onCheckedChange={(active) => void toggleCompany(selected, active)} data-testid="switch-company-status" /></div><Button variant="outline" onClick={() => setUserDialog(true)} data-testid="button-add-company-user"><Plus className="mr-2 h-4 w-4" />Add user</Button>{usersLoading ? <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin text-primary" /> : users.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No users have been added to this workspace.</p> : <div className="divide-y rounded-lg border">{users.map((user) => <div className="flex items-center justify-between p-3" key={user.id}><div><p className="text-sm font-semibold" data-testid={`text-user-${user.id}`}>{user.name}</p><p className="text-xs text-muted-foreground">{user.email}</p></div><span className="rounded bg-muted px-2 py-1 text-xs capitalize">{user.role}</span></div>)}</div>}</>}</DialogContent></Dialog>
    <Dialog open={userDialog} onOpenChange={setUserDialog}><DialogContent><DialogHeader><DialogTitle>Add workspace user</DialogTitle><DialogDescription>Add a user to {selected?.name}.</DialogDescription></DialogHeader><form onSubmit={userForm.handleSubmit(createUser)} className="space-y-4"><div><Label htmlFor="user-name">Name</Label><Input id="user-name" data-testid="input-user-name" {...userForm.register("name")} /><FieldError message={userForm.formState.errors.name?.message} /></div><div><Label htmlFor="user-email">Email</Label><Input id="user-email" type="email" data-testid="input-user-email" {...userForm.register("email")} /><FieldError message={userForm.formState.errors.email?.message} /></div><div><Label htmlFor="user-password">Temporary password</Label><Input id="user-password" type="password" data-testid="input-user-password" {...userForm.register("password")} /><FieldError message={userForm.formState.errors.password?.message} /></div><div><Label>Role</Label><Select value={userForm.watch("role")} onValueChange={(value) => userForm.setValue("role", value as UserValues["role"])}><SelectTrigger data-testid="select-user-role"><SelectValue /></SelectTrigger><SelectContent>{["admin", "manager", "mechanic", "driver"].map((role) => <SelectItem value={role} key={role} className="capitalize">{role}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="user-phone">Phone <span className="text-muted-foreground">(optional)</span></Label><Input id="user-phone" data-testid="input-user-phone" {...userForm.register("phone")} /></div><Button className="w-full" type="submit" disabled={userForm.formState.isSubmitting} data-testid="button-submit-user">{userForm.formState.isSubmitting ? "Adding…" : "Add user"}</Button></form></DialogContent></Dialog>
  </div>;
}