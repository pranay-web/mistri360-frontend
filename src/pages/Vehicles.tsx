import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListVehicles, getListVehiclesQueryKey, type ListVehiclesStatus, type ListVehiclesType, type ListVehiclesUrgency } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Search, Plus, SlidersHorizontal, ArrowRight, Activity, Gauge, Truck } from "lucide-react";
import { VehicleStatusBadge, VehicleUrgencyBadge, VehicleTypeLabel } from "@/components/vehicles/badges";
import { useDebounce } from "@/hooks/use-debounce";

export default function VehiclesPage() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState<ListVehiclesStatus | "all">("all");
  const [type, setType] = useState<ListVehiclesType | "all">("all");
  const [urgency, setUrgency] = useState<ListVehiclesUrgency | "all">("all");

  const queryParams = {
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(status !== "all" && { status }),
    ...(type !== "all" && { type }),
    ...(urgency !== "all" && { urgency }),
  };

  const { data: vehicles, isLoading } = useListVehicles(queryParams, {
    query: { queryKey: getListVehiclesQueryKey(queryParams) }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vehicles & PM Scheduling</h1>
          <p className="text-muted-foreground mt-1">Manage the fleet, track statuses, and monitor preventative maintenance.</p>
        </div>
        <Link href="/vehicles/new">
          <Button className="gap-2" data-testid="button-add-vehicle">
            <Plus className="h-4 w-4" />
            Add Vehicle
          </Button>
        </Link>
      </div>

      <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search unit #, VIN, plate, make/model..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-full bg-background"
                data-testid="input-search-vehicles"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground hidden sm:block" />
              <Select value={type} onValueChange={(v) => setType(v as ListVehiclesType | "all")}>
                <SelectTrigger className="w-full sm:w-[140px] bg-background" data-testid="select-filter-type">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="truck">Truck</SelectItem>
                  <SelectItem value="trailer">Dry Van</SelectItem>
                  <SelectItem value="reefer_trailer">Reefer</SelectItem>
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(v) => setStatus(v as ListVehiclesStatus | "all")}>
                <SelectTrigger className="w-full sm:w-[150px] bg-background" data-testid="select-filter-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="in_repair">In Repair</SelectItem>
                  <SelectItem value="out_of_service">Out of Service</SelectItem>
                  <SelectItem value="restricted">Restricted</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Select value={urgency} onValueChange={(v) => setUrgency(v as ListVehiclesUrgency | "all")}>
                <SelectTrigger className="w-full sm:w-[140px] bg-background" data-testid="select-filter-urgency">
                  <SelectValue placeholder="Urgency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Urgencies</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="due_soon">Due Soon</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Loading vehicles...</div>
          ) : !vehicles || vehicles.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Truck className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">No vehicles found</h3>
              <p className="text-muted-foreground mt-1 max-w-sm mx-auto">
                No vehicles match your current search and filter criteria. Try adjusting your filters.
              </p>
              <Button variant="outline" className="mt-4" onClick={() => { setSearch(""); setStatus("all"); setType("all"); setUrgency("all"); }}>
                Clear Filters
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[120px]">Unit #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Make & Model</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Readings</TableHead>
                  <TableHead className="text-center">PM Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map((v) => (
                  <TableRow 
                    key={v.id} 
                    className="cursor-pointer hover:bg-muted/30 transition-colors group"
                    onClick={() => setLocation(`/vehicles/${v.id}`)}
                    data-testid={`row-vehicle-${v.id}`}
                  >
                    <TableCell className="font-medium text-lg tracking-tight">
                      {v.unitNumber}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <VehicleTypeLabel type={v.vehicleType} />
                    </TableCell>
                    <TableCell>
                      <div>{v.make}</div>
                      <div className="text-sm text-muted-foreground">{v.year} {v.model}</div>
                    </TableCell>
                    <TableCell>
                      <VehicleStatusBadge status={v.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <div className="flex items-center justify-end gap-1.5 font-mono text-sm">
                        <span>{v.currentOdometer.toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground">km</span>
                      </div>
                      {(v.engineHours || v.reeferHours) && (
                        <div className="flex flex-col items-end gap-0.5 mt-1 text-xs text-muted-foreground">
                          {v.engineHours && <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> {v.engineHours} eh</span>}
                          {v.reeferHours && <span className="flex items-center gap-1"><Activity className="h-3 w-3 text-blue-400" /> {v.reeferHours} rh</span>}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <VehicleUrgencyBadge urgency={v.pmUrgency} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Need to import Truck from lucide-react if we used it inside
function TruckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10 17h4V5H2v12h3" />
      <path d="M20 17h2v-9h-5V5h-7" />
      <path d="M14 17h2" />
      <circle cx="8.5" cy="17.5" r="1.5" />
      <circle cx="15.5" cy="17.5" r="1.5" />
    </svg>
  );
}
// Actually let's just add Truck to lucide-react imports above
