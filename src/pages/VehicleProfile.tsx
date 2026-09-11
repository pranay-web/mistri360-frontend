import React from "react";
import { Link } from "wouter";
import { 
  useGetVehicle, 
  useGetVehiclePmSchedules, 
  useGetVehicleHistory, 
  useGetVehiclePmcvi,
  useGetVehicleUsInspections,
  useGetVehicleRoadsideViolations,
  useGetReportMaintenanceHistory,
  getGetVehicleQueryKey,
  getGetVehiclePmSchedulesQueryKey,
  getGetVehicleHistoryQueryKey,
  type PmcviRecord,
  type UsInspectionRecord,
  type RoadsideViolation,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Edit, Activity, Hash, CheckCircle, AlertCircle, Calendar, Wrench, ArrowRight, History } from "lucide-react";
import { VehicleStatusBadge, VehicleUrgencyBadge, VehicleTypeLabel } from "@/components/vehicles/badges";
import { UpdateOdometerDialog } from "@/components/vehicles/UpdateOdometerDialog";
import { UpdateStatusDialog } from "@/components/vehicles/UpdateStatusDialog";
import { format, parseISO } from "date-fns";

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return "—";
  try {
    return format(parseISO(dateString), "MMM d, yyyy");
  } catch (e) {
    return dateString;
  }
}

export default function VehicleProfilePage({ id }: { id: number }) {
  const { data: vehicle, isLoading: isLoadingVehicle } = useGetVehicle(id, {
    query: { queryKey: getGetVehicleQueryKey(id) }
  });

  const { data: schedules, isLoading: isLoadingSchedules } = useGetVehiclePmSchedules(id, {
    query: { queryKey: getGetVehiclePmSchedulesQueryKey(id) }
  });

  const { data: history, isLoading: isLoadingHistory } = useGetVehicleHistory(id, {
    query: { queryKey: getGetVehicleHistoryQueryKey(id) }
  });
  const historyTo = new Date().toISOString().slice(0, 10);
  const historyFromDate = new Date();
  historyFromDate.setFullYear(historyFromDate.getFullYear() - 3);
  const historyFrom = historyFromDate.toISOString().slice(0, 10);
  const { data: maintenanceHistory = [], isLoading: isLoadingMaintenance } = useGetReportMaintenanceHistory(
    { vehicleId: id, from: historyFrom, to: historyTo },
    { query: { queryKey: ["vehicle-maintenance-history", id, historyFrom, historyTo] } }
  );

  if (isLoadingVehicle) {
    return <div className="p-12 text-center animate-pulse text-muted-foreground">Loading vehicle profile...</div>;
  }

  if (!vehicle) {
    return (
      <div className="text-center p-12 space-y-4">
        <h2 className="text-2xl font-bold">Vehicle Not Found</h2>
        <p className="text-muted-foreground">The vehicle you're looking for does not exist.</p>
        <Link href="/vehicles">
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Vehicles</Button>
        </Link>
      </div>
    );
  }

  // Calculate PM Schedule state cards for Overview
  const pms = [
    { label: "PM1", date: vehicle.pm1DueDate, odo: vehicle.pm1DueOdometer, type: "service" },
    { label: "PM2", date: vehicle.pm2DueDate, odo: vehicle.pm2DueOdometer, type: "service" },
    { label: "Greasing", date: vehicle.greasingDueDate, odo: vehicle.greasingDueOdometer, type: "service" },
    { label: "PMCVI", date: vehicle.pmcviDueDate, odo: null, type: "inspection" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-6">
        <div className="flex items-center gap-4">
          <Link href="/vehicles">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{vehicle.unitNumber}</h1>
              <VehicleStatusBadge status={vehicle.status} className="text-sm px-2.5 py-0.5" />
            </div>
            <p className="text-muted-foreground flex items-center gap-2 mt-1">
              <span>{vehicle.year} {vehicle.make} {vehicle.model}</span>
              <span className="text-border">•</span>
              <span className="capitalize"><VehicleTypeLabel type={vehicle.vehicleType} /></span>
              {vehicle.licensePlate && (
                <>
                  <span className="text-border">•</span>
                  <Badge variant="secondary" className="font-mono text-xs">{vehicle.licensePlate} {vehicle.licenseProvince}</Badge>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <UpdateOdometerDialog 
            vehicleId={vehicle.id} 
            currentOdometer={vehicle.currentOdometer} 
            engineHours={vehicle.engineHours} 
            reeferHours={vehicle.reeferHours} 
          />
          <UpdateStatusDialog 
            vehicleId={vehicle.id} 
            currentStatus={vehicle.status} 
          />
          <Link href={`/vehicles/${vehicle.id}/edit`}>
            <Button className="gap-2" data-testid="button-edit-vehicle">
              <Edit className="h-4 w-4" />
              <span className="hidden sm:inline">Edit Details</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-muted/50 border border-border/50 flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="schedules">PM Schedules</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance History</TabsTrigger>
          <TabsTrigger value="history">Status History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Quick Stats */}
            <Card className="md:col-span-2 border-border/50 shadow-sm bg-card/50 backdrop-blur">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" /> Current Readings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Odometer</p>
                    <p className="text-3xl font-mono tracking-tight">{vehicle.currentOdometer.toLocaleString()}<span className="text-lg text-muted-foreground ml-1">km</span></p>
                  </div>
                  <div className="space-y-1 border-l border-border/50 pl-6">
                    <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Engine Hours</p>
                    <p className="text-2xl font-mono tracking-tight">{vehicle.engineHours || "—"}</p>
                  </div>
                  <div className="space-y-1 border-l border-border/50 pl-6">
                    <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Reefer Hours</p>
                    <p className="text-2xl font-mono tracking-tight">{vehicle.reeferHours || "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Identification */}
            <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Hash className="h-5 w-5 text-muted-foreground" /> Identification
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex justify-between border-b border-border/30 pb-2">
                  <span className="text-muted-foreground">VIN</span>
                  <span className="font-mono font-medium">{vehicle.vin}</span>
                </div>
                <div className="flex justify-between border-b border-border/30 pb-2">
                  <span className="text-muted-foreground">Color</span>
                  <span className="font-medium capitalize">{vehicle.color || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-border/30 pb-2">
                  <span className="text-muted-foreground">Reg Expiry</span>
                  <span className="font-medium">{formatDate(vehicle.registrationExpiry)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ins Expiry</span>
                  <span className="font-medium">{formatDate(vehicle.insuranceExpiry)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* PM Reminders Preview */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5" /> Maintenance Status
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {pms.map((pm, i) => {
                let statusColor = "bg-card text-foreground border-border/50";
                let icon = <CheckCircle className="h-4 w-4 text-green-500" />;
                
                // Very naive visual logic for preview - real logic would be server driven via `pmUrgency` 
                // but we can visually hint based on date if we had a full date library. 
                // We'll just show the date/odo here.
                
                return (
                  <Card key={i} className={`border ${statusColor} shadow-sm`}>
                    <CardContent className="p-4 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">{pm.label}</span>
                        {pm.type === "service" ? <Wrench className="h-4 w-4 text-muted-foreground" /> : <AlertCircle className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="text-xs space-y-1 mt-1">
                        {pm.date ? (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Date:</span>
                            <span className="font-medium">{formatDate(pm.date)}</span>
                          </div>
                        ) : null}
                        {pm.odo ? (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Odo:</span>
                            <span className="font-mono">{pm.odo.toLocaleString()} km</span>
                          </div>
                        ) : null}
                        {!pm.date && !pm.odo && (
                          <span className="text-muted-foreground italic">Not scheduled</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {vehicle.notes && (
            <Card className="border-border/50 bg-muted/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{vehicle.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="schedules">
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>Interval Settings</CardTitle>
              <CardDescription>Configured maintenance intervals for this vehicle. These values determine when reminders are generated.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSchedules ? (
                <div className="animate-pulse text-muted-foreground py-4">Loading schedules...</div>
              ) : schedules && schedules.length > 0 ? (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Distance Interval</TableHead>
                      <TableHead>Time Interval (Days)</TableHead>
                      <TableHead>Engine/Reefer Hrs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedules.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium uppercase">{s.pmType}</TableCell>
                        <TableCell>{s.intervalKm ? `${s.intervalKm.toLocaleString()} km` : "—"}</TableCell>
                        <TableCell>{s.intervalDays ? `${s.intervalDays} days` : "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 text-xs">
                            {s.intervalEngineHours && <span>{s.intervalEngineHours} eh</span>}
                            {s.intervalReeferHours && <span>{s.intervalReeferHours} rh</span>}
                            {!s.intervalEngineHours && !s.intervalReeferHours && "—"}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No PM schedules configured for this vehicle.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>Status History</CardTitle>
              <CardDescription>Log of operational status changes over time.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingHistory ? (
                <div className="animate-pulse text-muted-foreground py-4">Loading history...</div>
              ) : history && history.length > 0 ? (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Change</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>User</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(parseISO(h.createdAt), "MMM d, yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            {h.fromStatus && (
                              <>
                                <VehicleStatusBadge status={h.fromStatus} className="scale-90 origin-left" />
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              </>
                            )}
                            <VehicleStatusBadge status={h.toStatus} className="scale-90 origin-left" />
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate" title={h.reason || ""}>
                          {h.reason || <span className="text-muted-foreground italic">No reason provided</span>}
                        </TableCell>
                        <TableCell>{h.changedByName || "System"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No status changes recorded yet.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-primary" /> Three-Year Maintenance History</CardTitle>
                <CardDescription>Completed and past PM, repair, inspection, parts, labour, and odometer records from {formatDate(historyFrom)} to today.</CardDescription>
              </div>
              <Badge variant="secondary">{maintenanceHistory.length} records</Badge>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingMaintenance ? (
                <div className="py-12 text-center text-muted-foreground">Loading maintenance history…</div>
              ) : maintenanceHistory.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">No maintenance records found in the last three years.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Work Order</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Mechanic</TableHead>
                      <TableHead>Odometer</TableHead>
                      <TableHead>Labour</TableHead>
                      <TableHead className="text-right">Parts Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(maintenanceHistory as any[]).map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="whitespace-nowrap text-sm">{formatDate(record.completedAt ?? record.createdAt)}</TableCell>
                        <TableCell><Link href={`/work-orders/${record.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">{record.woNumber}</Link></TableCell>
                        <TableCell className="text-sm capitalize">{record.workOrderType?.replace(/_/g, " ")}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{record.status?.replace(/_/g, " ")}</Badge></TableCell>
                        <TableCell className="text-sm">{record.mechanicName ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{record.odometerAtService ? `${Number(record.odometerAtService).toLocaleString()} km` : "—"}</TableCell>
                        <TableCell className="text-sm">{record.totalLabourHours ? `${Number(record.totalLabourHours).toFixed(1)} h` : "—"}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{record.totalPartsCost ? `$${Number(record.totalPartsCost).toFixed(2)}` : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Compliance Tab ─────────────────────────────────────────────── */}
        <TabsContent value="compliance" className="space-y-6">
          <ComplianceTabContent vehicleId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Inline Compliance Tab ─────────────────────────────────────────────────────

function ExpiryChip({ expiryDate }: { expiryDate: string | null | undefined }) {
  if (!expiryDate) return <span className="text-muted-foreground text-xs">—</span>;
  const days = Math.round((new Date(expiryDate).getTime() - Date.now()) / 86_400_000);
  const color =
    days < 0 ? "text-red-400 border-red-400/40 bg-red-950/20" :
    days <= 30 ? "text-orange-400 border-orange-400/40 bg-orange-950/10" :
    days <= 90 ? "text-amber-400 border-amber-400/40 bg-amber-950/10" :
    "text-green-400 border-green-400/40 bg-green-950/10";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${color}`}>
      {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
    </span>
  );
}

function ComplianceTabContent({ vehicleId }: { vehicleId: number }) {
  const { data: pmcvis = [], isLoading: loadingP } = useGetVehiclePmcvi(vehicleId);
  const { data: violations = [], isLoading: loadingV } = useGetVehicleRoadsideViolations(vehicleId);

  const latestPmcvi = (pmcvis as PmcviRecord[])[0];
  const openViolations = (violations as RoadsideViolation[]).filter((v) => !v.resolved);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">PMCVI (Ontario)</p>
            {latestPmcvi ? (
              <div className="flex flex-col gap-1">
                <ExpiryChip expiryDate={latestPmcvi.expiryDate} />
                <p className="text-xs text-muted-foreground mt-1">Expires {latestPmcvi.expiryDate}</p>
                {latestPmcvi.isOfficiallyPassed
                  ? <p className="text-xs text-green-400">✓ Officially Passed</p>
                  : <p className="text-xs text-amber-400">⚠ DriveON pending</p>}
              </div>
            ) : <p className="text-sm text-muted-foreground">No records</p>}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Open Violations</p>
            <p className={`text-3xl font-bold ${openViolations.length > 0 ? "text-orange-400" : "text-green-400"}`}>
              {openViolations.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{violations.length} total logged</p>
          </CardContent>
        </Card>
      </div>

      {/* PMCVI history */}
      {(pmcvis as PmcviRecord[]).length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">PMCVI History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Inspection Date</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>DriveON</TableHead>
                  <TableHead>Cert #</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(pmcvis as PmcviRecord[]).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{r.inspectionDate}</TableCell>
                    <TableCell><ExpiryChip expiryDate={r.expiryDate} /></TableCell>
                    <TableCell className="text-sm capitalize">{r.result}</TableCell>
                    <TableCell>{r.isOfficiallyPassed ? <span className="text-xs text-green-400">Passed ✓</span> : r.driveOnDocumentKey ? <span className="text-xs text-amber-400">Uploaded</span> : <span className="text-xs text-muted-foreground">Pending</span>}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{r.certificateNumber ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Roadside violations */}
      {(violations as RoadsideViolation[]).length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Roadside Violations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(violations as RoadsideViolation[]).map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="text-sm">{v.inspectionDate}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{v.violationCode ?? "—"}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{v.violationDescription}</TableCell>
                    <TableCell className="text-xs font-bold uppercase">{v.severity}</TableCell>
                    <TableCell>{v.resolved ? <span className="text-xs text-green-400">Resolved</span> : <span className="text-xs text-orange-400">Open</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {loadingP || loadingV ? <p className="text-center text-muted-foreground animate-pulse py-4">Loading compliance records…</p> : null}
      {!loadingP && !loadingV && pmcvis.length === 0 && violations.length === 0 && (
        <p className="text-center text-muted-foreground py-8">No compliance records for this vehicle. Use the <Link href="/compliance" className="text-primary underline">Compliance page</Link> to add records.</p>
      )}
    </div>
  );
}
