import React, { useState } from "react";
import { useUpdateVehicleStatus, getGetVehicleQueryKey, getListVehiclesQueryKey, getGetVehicleHistoryQueryKey, type VehicleStatusInputStatus } from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Truck, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { VehicleStatusBadge } from "./badges";

export function UpdateStatusDialog({ vehicleId, currentStatus }: { vehicleId: number, currentStatus: string }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  
  const [status, setStatus] = useState<VehicleStatusInputStatus>(currentStatus as VehicleStatusInputStatus);
  const [reason, setReason] = useState("");

  const updateMut = useUpdateVehicleStatus();

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setStatus(currentStatus as VehicleStatusInputStatus);
      setReason("");
    }
    setOpen(newOpen);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (status === currentStatus) {
      setOpen(false);
      return;
    }

    updateMut.mutate({ id: vehicleId, data: { status, reason: reason || undefined } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetVehicleQueryKey(vehicleId) });
        queryClient.invalidateQueries({ queryKey: getListVehiclesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetVehicleHistoryQueryKey(vehicleId) });
        toast({ title: "Status updated", description: "Vehicle operational status has been updated." });
        setOpen(false);
      },
      onError: (err) => {
        toast({ title: "Error", description: (err as any)?.response?.data?.error || "Failed to update status", variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" data-testid="button-change-status">
          <Truck className="h-4 w-4" />
          <span className="hidden sm:inline">Change Status</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Change Operational Status</DialogTitle>
            <DialogDescription>
              Update whether this vehicle is available for dispatch, in repair, or out of service.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-muted-foreground">Current:</span>
              <VehicleStatusBadge status={currentStatus} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">New Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as VehicleStatusInputStatus)}>
                <SelectTrigger id="status" data-testid="select-new-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="in_repair">In Repair</SelectItem>
                  <SelectItem value="out_of_service">Out of Service</SelectItem>
                  <SelectItem value="restricted">Restricted</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Textarea id="reason" placeholder="Why is the status changing?" value={reason} onChange={(e) => setReason(e.target.value)} data-testid="input-status-reason" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={updateMut.isPending || status === currentStatus} data-testid="button-save-status">
              {updateMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Status
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
