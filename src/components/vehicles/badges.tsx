import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function VehicleStatusBadge({ status, className }: { status: string, className?: string }) {
  const colors: Record<string, string> = {
    available: "bg-green-500/15 text-green-500 hover:bg-green-500/25 border-green-500/20",
    in_repair: "bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 border-amber-500/20",
    out_of_service: "bg-red-500/15 text-red-500 hover:bg-red-500/25 border-red-500/20",
    restricted: "bg-orange-500/15 text-orange-500 hover:bg-orange-500/25 border-orange-500/20",
    inactive: "bg-gray-500/15 text-gray-400 hover:bg-gray-500/25 border-gray-500/20",
  };

  const labels: Record<string, string> = {
    available: "Available",
    in_repair: "In Repair",
    out_of_service: "Out of Service",
    restricted: "Restricted",
    inactive: "Inactive",
  };

  return (
    <Badge variant="outline" className={cn("font-medium", colors[status] || colors.inactive, className)}>
      {labels[status] || status}
    </Badge>
  );
}

export function VehicleUrgencyBadge({ urgency, className }: { urgency: string | null | undefined, className?: string }) {
  if (!urgency || urgency === "ok") return <Badge variant="outline" className={cn("text-green-500 bg-green-500/10 border-green-500/20 font-medium", className)}>OK</Badge>;
  
  if (urgency === "overdue") {
    return <Badge variant="outline" className={cn("bg-red-500 text-white border-transparent hover:bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.3)] font-medium tracking-wide", className)}>Overdue</Badge>;
  }
  
  if (urgency === "due_soon") {
    return <Badge variant="outline" className={cn("bg-amber-500 text-white border-transparent hover:bg-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.3)] font-medium tracking-wide", className)}>Due Soon</Badge>;
  }

  return null;
}

export function VehicleTypeLabel({ type }: { type: string }) {
  const labels: Record<string, string> = {
    truck: "Truck",
    trailer: "Dry Van",
    reefer_trailer: "Reefer",
  };
  return <span>{labels[type] || type}</span>;
}
