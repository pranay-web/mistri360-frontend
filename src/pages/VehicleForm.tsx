import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateVehicle, useGetVehicle, useUpdateVehicle, getListVehiclesQueryKey, getGetVehicleQueryKey } from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Save, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  unitNumber: z.string().min(1, "Unit Number is required"),
  vehicleType: z.enum(["truck", "trailer", "reefer_trailer"]),
  status: z.enum(["available", "in_repair", "out_of_service", "restricted", "inactive"]).default("available"),
  vin: z.string().min(1, "VIN is required"),
  licensePlate: z.string().min(1, "License Plate is required"),
  licenseProvince: z.string().optional(),
  year: z.coerce.number().min(1980).max(2100),
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  color: z.string().optional(),
  
  currentOdometer: z.coerce.number().min(0, "Must be >= 0").default(0),
  engineHours: z.string().optional(),
  reeferHours: z.string().optional(),
  
  pm1DueDate: z.string().optional().nullable(),
  pm1DueOdometer: z.coerce.number().optional().nullable(),
  pm2DueDate: z.string().optional().nullable(),
  pm2DueOdometer: z.coerce.number().optional().nullable(),
  greasingDueDate: z.string().optional().nullable(),
  greasingDueOdometer: z.coerce.number().optional().nullable(),
  pmcviDueDate: z.string().optional().nullable(),
  registrationExpiry: z.string().optional().nullable(),
  insuranceExpiry: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

export default function VehicleFormPage({ mode, id }: { mode: "create" | "edit"; id?: number }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  
  const { data: vehicle, isLoading: isLoadingVehicle } = useGetVehicle(id!, {
    query: { enabled: mode === "edit" && !!id, queryKey: getGetVehicleQueryKey(id!) }
  });

  const createVehicle = useCreateVehicle();
  const updateVehicle = useUpdateVehicle();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      unitNumber: "", vehicleType: "truck", status: "available",
      vin: "", licensePlate: "", licenseProvince: "",
      year: new Date().getFullYear(), make: "", model: "", color: "",
      currentOdometer: 0, engineHours: "", reeferHours: "",
      pm1DueDate: "", pm1DueOdometer: null,
      pm2DueDate: "", pm2DueOdometer: null,
      greasingDueDate: "", greasingDueOdometer: null,
      pmcviDueDate: "",
      registrationExpiry: "", insuranceExpiry: "",
      notes: ""
    }
  });

  useEffect(() => {
    if (mode === "edit" && vehicle) {
      form.reset({
        unitNumber: vehicle.unitNumber,
        vehicleType: vehicle.vehicleType,
        status: vehicle.status,
        vin: vehicle.vin,
        licensePlate: vehicle.licensePlate,
        licenseProvince: vehicle.licenseProvince || "",
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        color: vehicle.color || "",
        currentOdometer: vehicle.currentOdometer,
        engineHours: vehicle.engineHours || "",
        reeferHours: vehicle.reeferHours || "",
        pm1DueDate: vehicle.pm1DueDate?.split('T')[0] || "",
        pm1DueOdometer: vehicle.pm1DueOdometer || null,
        pm2DueDate: vehicle.pm2DueDate?.split('T')[0] || "",
        pm2DueOdometer: vehicle.pm2DueOdometer || null,
        greasingDueDate: vehicle.greasingDueDate?.split('T')[0] || "",
        greasingDueOdometer: vehicle.greasingDueOdometer || null,
        pmcviDueDate: vehicle.pmcviDueDate?.split('T')[0] || "",
        registrationExpiry: vehicle.registrationExpiry?.split('T')[0] || "",
        insuranceExpiry: vehicle.insuranceExpiry?.split('T')[0] || "",
        notes: vehicle.notes || "",
      });
    }
  }, [mode, vehicle, form]);

  const validateStepAndProceed = async (nextStep: number) => {
    let fieldsToValidate: any[] = [];
    if (step === 1) {
      fieldsToValidate = ["unitNumber", "vehicleType", "status", "vin", "licensePlate", "year", "make", "model"];
    } else if (step === 2) {
      fieldsToValidate = ["currentOdometer"];
    }
    
    if (fieldsToValidate.length > 0) {
      const isValid = await form.trigger(fieldsToValidate as any);
      if (!isValid) return;
    }
    setStep(nextStep);
  };

  const onSubmit = (data: FormValues) => {
    const payload = {
      ...data,
      notes: data.notes ?? undefined,
      engineHours: data.engineHours || undefined,
      reeferHours: data.reeferHours || undefined,
      pm1DueDate: data.pm1DueDate || undefined,
      pm2DueDate: data.pm2DueDate || undefined,
      greasingDueDate: data.greasingDueDate || undefined,
      pmcviDueDate: data.pmcviDueDate || undefined,
      registrationExpiry: data.registrationExpiry || undefined,
      insuranceExpiry: data.insuranceExpiry || undefined,
      pm1DueOdometer: data.pm1DueOdometer || undefined,
      pm2DueOdometer: data.pm2DueOdometer || undefined,
      greasingDueOdometer: data.greasingDueOdometer || undefined,
    };

    if (mode === "create") {
      createVehicle.mutate({ data: payload }, {
        onSuccess: (newVehicle) => {
          queryClient.invalidateQueries({ queryKey: getListVehiclesQueryKey() });
          toast({ title: "Vehicle created", description: `${newVehicle.unitNumber} has been added to the fleet.` });
          setLocation(`/vehicles/${newVehicle.id}`);
        },
        onError: (err) => {
          toast({ title: "Error", description: (err as any)?.response?.data?.error || "Failed to create vehicle", variant: "destructive" });
        }
      });
    } else {
      updateVehicle.mutate({ id: id!, data: payload }, {
        onSuccess: (updatedVehicle) => {
          queryClient.invalidateQueries({ queryKey: getGetVehicleQueryKey(id!) });
          queryClient.invalidateQueries({ queryKey: getListVehiclesQueryKey() });
          toast({ title: "Vehicle updated", description: `${updatedVehicle.unitNumber} has been updated.` });
          setLocation(`/vehicles/${updatedVehicle.id}`);
        },
        onError: (err) => {
          toast({ title: "Error", description: (err as any)?.response?.data?.error || "Failed to update vehicle", variant: "destructive" });
        }
      });
    }
  };

  if (mode === "edit" && isLoadingVehicle) {
    return <div className="p-8 text-center animate-pulse text-muted-foreground">Loading vehicle data...</div>;
  }

  const steps = [
    { num: 1, title: "Basic Info" },
    { num: 2, title: "Current Readings" },
    { num: 3, title: "Dates & Schedule" },
    { num: 4, title: "Review" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation(mode === "edit" ? `/vehicles/${id}` : "/vehicles")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{mode === "create" ? "Add New Vehicle" : `Edit Vehicle ${vehicle?.unitNumber}`}</h1>
          <p className="text-muted-foreground mt-1">Complete the information below to {mode === "create" ? "register a new" : "update this"} vehicle.</p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-8 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-muted z-0"></div>
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-primary z-0 transition-all duration-300" style={{ width: `${((step - 1) / 3) * 100}%` }}></div>
        {steps.map((s) => (
          <div key={s.num} className="relative z-10 flex flex-col items-center gap-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 transition-colors ${step >= s.num ? "bg-primary border-primary text-primary-foreground" : "bg-card border-muted text-muted-foreground"}`}>
              {step > s.num ? <CheckCircle2 className="h-5 w-5" /> : s.num}
            </div>
            <span className={`text-xs font-medium ${step >= s.num ? "text-foreground" : "text-muted-foreground"}`}>{s.title}</span>
          </div>
        ))}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur">
            <CardHeader className="border-b border-border/50 bg-muted/10">
              <CardTitle>{steps[step - 1].title}</CardTitle>
              <CardDescription>
                {step === 1 && "Core identification and categorization."}
                {step === 2 && "Current odometer and engine hours."}
                {step === 3 && "Preventative maintenance schedules and expiries."}
                {step === 4 && "Review the details before saving."}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              
              {/* STEP 1: Basic Info */}
              <div className={step === 1 ? "block" : "hidden"}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="unitNumber" render={({ field }) => (
                    <FormItem><FormLabel>Unit Number *</FormLabel><FormControl><Input {...field} data-testid="input-unit" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="vin" render={({ field }) => (
                    <FormItem><FormLabel>VIN *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="vehicleType" render={({ field }) => (
                    <FormItem><FormLabel>Vehicle Type *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="truck">Truck</SelectItem>
                          <SelectItem value="trailer">Dry Van</SelectItem>
                          <SelectItem value="reefer_trailer">Reefer</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem><FormLabel>Initial Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="available">Available</SelectItem>
                          <SelectItem value="in_repair">In Repair</SelectItem>
                          <SelectItem value="out_of_service">Out of Service</SelectItem>
                          <SelectItem value="restricted">Restricted</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="year" render={({ field }) => (
                    <FormItem><FormLabel>Year *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="make" render={({ field }) => (
                    <FormItem><FormLabel>Make *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="model" render={({ field }) => (
                    <FormItem><FormLabel>Model *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="color" render={({ field }) => (
                    <FormItem><FormLabel>Color</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="licensePlate" render={({ field }) => (
                    <FormItem><FormLabel>License Plate *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="licenseProvince" render={({ field }) => (
                    <FormItem><FormLabel>Province / State</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </div>

              {/* STEP 2: Current Readings */}
              <div className={step === 2 ? "block" : "hidden"}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="currentOdometer" render={({ field }) => (
                    <FormItem><FormLabel>Current Odometer (km) *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="engineHours" render={({ field }) => (
                    <FormItem><FormLabel>Engine Hours</FormLabel><FormControl><Input {...field} value={field.value || ""} placeholder="e.g. 4500" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="reeferHours" render={({ field }) => (
                    <FormItem><FormLabel>Reefer Hours</FormLabel><FormControl><Input {...field} value={field.value || ""} placeholder="e.g. 1200" /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </div>

              {/* STEP 3: Dates & Schedule */}
              <div className={step === 3 ? "block" : "hidden"}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
                  <div className="space-y-4 border p-4 rounded-lg bg-muted/5">
                    <h3 className="font-semibold border-b pb-2">PM1 Schedule</h3>
                    <FormField control={form.control} name="pm1DueDate" render={({ field }) => (
                      <FormItem><FormLabel>PM1 Due Date</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="pm1DueOdometer" render={({ field }) => (
                      <FormItem><FormLabel>PM1 Due Odometer (km)</FormLabel><FormControl><Input type="number" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <div className="space-y-4 border p-4 rounded-lg bg-muted/5">
                    <h3 className="font-semibold border-b pb-2">PM2 Schedule</h3>
                    <FormField control={form.control} name="pm2DueDate" render={({ field }) => (
                      <FormItem><FormLabel>PM2 Due Date</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="pm2DueOdometer" render={({ field }) => (
                      <FormItem><FormLabel>PM2 Due Odometer (km)</FormLabel><FormControl><Input type="number" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <div className="space-y-4 border p-4 rounded-lg bg-muted/5">
                    <h3 className="font-semibold border-b pb-2">Greasing Schedule</h3>
                    <FormField control={form.control} name="greasingDueDate" render={({ field }) => (
                      <FormItem><FormLabel>Greasing Due Date</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="greasingDueOdometer" render={({ field }) => (
                      <FormItem><FormLabel>Greasing Due Odometer (km)</FormLabel><FormControl><Input type="number" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <div className="space-y-4 border p-4 rounded-lg bg-muted/5">
                    <h3 className="font-semibold border-b pb-2">Inspections & Renewals</h3>
                    <FormField control={form.control} name="pmcviDueDate" render={({ field }) => (
                      <FormItem><FormLabel>PMCVI Due Date</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="registrationExpiry" render={({ field }) => (
                      <FormItem><FormLabel>Registration Expiry</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="insuranceExpiry" render={({ field }) => (
                      <FormItem><FormLabel>Insurance Expiry</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                </div>
                <div className="mt-6">
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea className="min-h-[100px]" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </div>

              {/* STEP 4: Review */}
              <div className={step === 4 ? "block" : "hidden"}>
                <div className="rounded-lg border bg-muted/5 p-6 space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><span className="text-muted-foreground block mb-1">Unit Number</span><span className="font-medium text-lg">{form.getValues("unitNumber") || "—"}</span></div>
                    <div><span className="text-muted-foreground block mb-1">Type</span><span className="font-medium capitalize">{form.getValues("vehicleType").replace("_", " ")}</span></div>
                    <div><span className="text-muted-foreground block mb-1">Make & Model</span><span className="font-medium">{form.getValues("make")} {form.getValues("model")} ({form.getValues("year")})</span></div>
                    <div><span className="text-muted-foreground block mb-1">VIN</span><span className="font-medium break-all">{form.getValues("vin") || "—"}</span></div>
                    
                    <div><span className="text-muted-foreground block mb-1">License Plate</span><span className="font-medium">{form.getValues("licensePlate") || "—"}</span></div>
                    <div><span className="text-muted-foreground block mb-1">Current Odometer</span><span className="font-medium">{form.getValues("currentOdometer")} km</span></div>
                    <div><span className="text-muted-foreground block mb-1">Status</span><span className="font-medium capitalize">{form.getValues("status").replace("_", " ")}</span></div>
                  </div>
                  <div className="bg-amber-500/10 text-amber-500 p-4 rounded border border-amber-500/20 text-sm">
                    Please review the details above. Check the scheduled dates on the previous step if needed. Click submit when ready.
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t border-border/50 bg-muted/10 flex justify-between p-6">
              {step > 1 ? (
                <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
              ) : <div></div>}
              
              {step < 4 ? (
                <Button type="button" onClick={() => validateStepAndProceed(step + 1)}>
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" disabled={createVehicle.isPending || updateVehicle.isPending} className="gap-2" data-testid="button-submit-vehicle">
                  {(createVehicle.isPending || updateVehicle.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Save className="h-4 w-4" />
                  {mode === "create" ? "Create Vehicle" : "Save Changes"}
                </Button>
              )}
            </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
  );
}
