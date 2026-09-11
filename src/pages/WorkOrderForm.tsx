import { useState } from "react";
import { useLocation } from "wouter";
import {
  useCreateWorkOrder,
  useListVehicles,
  getListWorkOrdersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const WORK_ORDER_TYPES = [
  { value: "pm1", label: "PM1 — Preventative Maintenance 1" },
  { value: "pm2", label: "PM2 — Preventative Maintenance 2" },
  { value: "greasing", label: "Greasing" },
  { value: "trailer_maintenance", label: "Trailer Maintenance" },
  { value: "reefer_maintenance", label: "Reefer / Refrigeration" },
  { value: "driver_defect", label: "Driver Reported Defect" },
  { value: "breakdown", label: "Breakdown" },
  { value: "roadside_repair", label: "Roadside Repair" },
  { value: "pmcvi_prep", label: "PMCVI Preparation" },
  { value: "general_repair", label: "General Repair" },
];

export default function WorkOrderFormPage() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const createWO = useCreateWorkOrder();
  const { data: vehicles = [] } = useListVehicles();
  const { data: customers = [] } = useQuery({
    queryKey: ["customers", "active"],
    queryFn: async () => {
      const res = await fetch("/api/customers", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load customers");
      return res.json() as Promise<Array<{ id: number; name: string; customerCode: string; active: boolean }>>;
    },
  });

  const [form, setForm] = useState({
    vehicleId: "",
    customerId: "",
    workOrderType: "",
    priority: "normal",
    description: "",
    scheduledDate: "",
    odometerAtService: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vehicleId || !form.workOrderType) {
      toast.error("Vehicle and work order type are required");
      return;
    }

    createWO.mutate(
      {
        data: {
          vehicleId: Number(form.vehicleId),
          customerId: form.customerId ? Number(form.customerId) : undefined,
          workOrderType: form.workOrderType as any,
          priority: form.priority as any,
          description: form.description || undefined,
          scheduledDate: form.scheduledDate || undefined,
          odometerAtService: form.odometerAtService ? Number(form.odometerAtService) : undefined,
        },
      },
      {
        onSuccess: (wo) => {
          qc.invalidateQueries({ queryKey: getListWorkOrdersQueryKey() });
          toast.success(`Work order ${wo.woNumber} created`);
          setLocation(`/work-orders/${wo.id}`);
        },
        onError: (err) => {
          toast.error((err as any)?.response?.data?.error ?? "Failed to create work order");
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/work-orders")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">New Work Order</h1>
          <p className="text-sm text-muted-foreground">Create a maintenance job for a vehicle</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Job Details</CardTitle>
            <CardDescription>Core information about this work order</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Vehicle */}
            <div>
              <Label htmlFor="vehicle">Vehicle *</Label>
              <Select value={form.vehicleId} onValueChange={(v) => setForm({ ...form, vehicleId: v })}>
                <SelectTrigger className="mt-1" id="vehicle">
                  <SelectValue placeholder="Select a vehicle..." />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.unitNumber} — {v.year} {v.make} {v.model}
                      {v.status !== "available" && (
                        <span className="ml-2 text-xs text-muted-foreground capitalize">({v.status.replace(/_/g, " ")})</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Work order type */}
            <div>
              <Label htmlFor="customer">Customer</Label>
              <Select value={form.customerId || "none"} onValueChange={(v) => setForm({ ...form, customerId: v === "none" ? "" : v })}>
                <SelectTrigger className="mt-1" id="customer">
                  <SelectValue placeholder="Internal / no customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Internal / no customer</SelectItem>
                  {customers.filter((c) => c.active).map((customer) => (
                    <SelectItem key={customer.id} value={String(customer.id)}>
                      {customer.name} · {customer.customerCode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">Assign this job to a customer account when applicable.</p>
            </div>

            {/* Work order type */}
            <div>
              <Label htmlFor="type">Work Order Type *</Label>
              <Select value={form.workOrderType} onValueChange={(v) => setForm({ ...form, workOrderType: v })}>
                <SelectTrigger className="mt-1" id="type">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {WORK_ORDER_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger className="mt-1" id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                className="mt-1 resize-none"
                rows={3}
                placeholder="Describe the work to be performed..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            {/* Scheduled date + odometer */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="scheduledDate">Scheduled Date</Label>
                <div className="flex gap-1.5 mt-1">
                  <Input
                    id="scheduledDate"
                    type="date"
                    className="flex-1"
                    value={form.scheduledDate}
                    onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
                  />
                  {form.scheduledDate && (
                    <button
                      type="button"
                      title="Clear date"
                      className="text-muted-foreground hover:text-foreground text-sm px-2 rounded border border-input bg-background hover:bg-accent transition-colors"
                      onClick={() => setForm({ ...form, scheduledDate: "" })}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
              <div>
                <Label htmlFor="odometer">Odometer at Service (km)</Label>
                <Input
                  id="odometer"
                  type="number"
                  min="0"
                  className="mt-1"
                  placeholder="e.g. 145000"
                  value={form.odometerAtService}
                  onChange={(e) => setForm({ ...form, odometerAtService: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setLocation("/work-orders")}>
                Cancel
              </Button>
              <Button type="submit" disabled={createWO.isPending}>
                {createWO.isPending ? "Creating..." : "Create Work Order"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
