import React, { useState } from "react";
import { useUpdateVehicleOdometer, getGetVehicleQueryKey, getListVehiclesQueryKey } from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gauge, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function UpdateOdometerDialog({ vehicleId, currentOdometer, engineHours, reeferHours }: { vehicleId: number, currentOdometer: number, engineHours?: string | null, reeferHours?: string | null }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  
  const [odometer, setOdometer] = useState(currentOdometer.toString());
  const [eHours, setEHours] = useState(engineHours || "");
  const [rHours, setRHours] = useState(reeferHours || "");

  const updateMut = useUpdateVehicleOdometer();

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setOdometer(currentOdometer.toString());
      setEHours(engineHours || "");
      setRHours(reeferHours || "");
    }
    setOpen(newOpen);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {};
    if (odometer && Number(odometer) !== currentOdometer) payload.odometer = Number(odometer);
    if (eHours !== (engineHours || "")) payload.engineHours = eHours;
    if (rHours !== (reeferHours || "")) payload.reeferHours = rHours;

    if (Object.keys(payload).length === 0) {
      setOpen(false);
      return;
    }

    updateMut.mutate({ id: vehicleId, data: payload }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetVehicleQueryKey(vehicleId) });
        queryClient.invalidateQueries({ queryKey: getListVehiclesQueryKey() });
        toast({ title: "Readings updated", description: "Odometer/hours have been saved successfully." });
        setOpen(false);
      },
      onError: (err) => {
        toast({ title: "Error", description: (err as any)?.response?.data?.error || "Failed to update readings", variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" data-testid="button-update-odometer">
          <Gauge className="h-4 w-4" />
          <span className="hidden sm:inline">Update Readings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Update Readings</DialogTitle>
            <DialogDescription>
              Record the latest odometer reading and engine hours. This may trigger PM reminders.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="odometer">Odometer (km)</Label>
              <Input id="odometer" type="number" value={odometer} onChange={(e) => setOdometer(e.target.value)} required min={currentOdometer} data-testid="input-odometer" />
              <p className="text-xs text-muted-foreground">Current: {currentOdometer} km</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="engineHours">Engine Hours</Label>
              <Input id="engineHours" value={eHours} onChange={(e) => setEHours(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reeferHours">Reefer Hours</Label>
              <Input id="reeferHours" value={rHours} onChange={(e) => setRHours(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={updateMut.isPending} data-testid="button-save-odometer">
              {updateMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Readings
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
