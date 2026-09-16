import { lazy, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, useLocation, Redirect } from 'wouter';
import { useGetMe, getGetMeQueryKey } from '@workspace/api-client-react';
import { queryClient } from '@/lib/queryClient';

const LazyDefects = lazy(() => import("@/pages/Defects"));
const LazyCompliance = lazy(() => import("@/pages/Compliance"));
const LazyReports = lazy(() => import("@/pages/Reports"));

import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import PlaceholderPage from '@/pages/Placeholder';
import VehiclesPage from '@/pages/Vehicles';
import VehicleProfilePage from '@/pages/VehicleProfile';
import VehicleFormPage from '@/pages/VehicleForm';
import WorkOrdersPage from '@/pages/WorkOrders';
import WorkOrderDetailPage from '@/pages/WorkOrderDetail';
import WorkOrderFormPage from '@/pages/WorkOrderForm';
import ChecklistsPage from '@/pages/Checklists';
import { AppShell } from '@/components/layout/AppShell';
import Platform from '@/pages/Platform';
import CustomersPage from '@/pages/Customers';
import EstimatesPage from '@/pages/Estimates';
import InvoicesPage from '@/pages/Invoices';

function ProtectedRoutes() {
  const { data: user, isLoading, isError } = useGetMe({
    query: { queryKey: getGetMeQueryKey() }
  });
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // Allow unauthenticated access to either sign-in mode.
  if (!user || isError) {
    if (location !== '/login' && location !== '/platform-login') {
      return <Redirect to="/login" />;
    }
    return (
      <Switch>
        <Route path="/login" component={() => <Login />} />
        <Route path="/platform-login" component={() => <Login platformMode />} />
        <Route component={() => <Redirect to="/login" />} />
      </Switch>
    );
  }

  // If authenticated and trying to hit login, send to role home
  const role = (user as any)?.role as string;
  const workspaceHome = role === 'driver' ? '/defects' : '/dashboard';
  if (location === '/login' || location === '/platform-login') {
    return <Redirect to={role === 'platform_admin' ? '/platform' : workspaceHome} />;
  }
  if (role === 'platform_admin') return location === '/platform' ? <Platform /> : <Redirect to="/platform" />;
  if (location === '/platform') return <Redirect to={workspaceHome} />;

  const access: Record<string, string[]> = {
    admin: ["/dashboard", "/vehicles", "/work-orders", "/customers", "/estimates", "/invoices", "/checklists", "/defects", "/compliance", "/reports"],
    manager: ["/dashboard", "/vehicles", "/work-orders", "/customers", "/estimates", "/invoices", "/checklists", "/defects", "/compliance", "/reports"],
    mechanic: ["/dashboard", "/vehicles", "/work-orders", "/customers", "/estimates", "/invoices", "/checklists", "/defects", "/compliance", "/reports"],
    driver: ["/defects"],
  };
  const permitted = (access[role] || []).some((path) => location === path || location.startsWith(`${path}/`));
  if (!permitted && location !== '/') return <Redirect to={workspaceHome} />;

  // Authenticated Shell
  return (
    <AppShell user={user}>
      <Switch>
        <Route path="/" component={() => <Redirect to={workspaceHome} />} />
        <Route path="/dashboard" component={() => role === 'driver' ? <Redirect to="/defects" /> : <Dashboard />} />
        <Route path="/vehicles" component={VehiclesPage} />
        <Route path="/vehicles/new" component={() => <VehicleFormPage mode="create" />} />
        <Route path="/vehicles/:id/edit">
          {(params) => <VehicleFormPage mode="edit" id={Number(params?.id)} />}
        </Route>
        <Route path="/vehicles/:id">
          {(params) => <VehicleProfilePage id={Number(params?.id)} />}
        </Route>
        <Route path="/work-orders" component={WorkOrdersPage} />
        <Route path="/work-orders/new" component={WorkOrderFormPage} />
        <Route path="/work-orders/:id">
          {(params) => <WorkOrderDetailPage id={Number(params?.id)} />}
        </Route>
        <Route path="/customers" component={CustomersPage} />
        <Route path="/estimates" component={() => <EstimatesPage />} />
        <Route path="/estimates/:id">{(params) => <EstimatesPage id={Number(params?.id)} />}</Route>
        <Route path="/invoices" component={() => <InvoicesPage />} />
        <Route path="/invoices/:id">{(params) => <InvoicesPage id={Number(params?.id)} />}</Route>
        <Route path="/checklists" component={ChecklistsPage} />
        <Route path="/defects">
          {() => <Suspense fallback={<div className="flex items-center justify-center py-20 text-muted-foreground animate-pulse">Loading…</div>}><LazyDefects /></Suspense>}
        </Route>
        <Route path="/compliance">
          {() => <Suspense fallback={<div className="flex items-center justify-center py-20 text-muted-foreground animate-pulse">Loading…</div>}><LazyCompliance /></Suspense>}
        </Route>
        <Route path="/reports">
          {() => <Suspense fallback={<div className="flex items-center justify-center py-20 text-muted-foreground animate-pulse">Loading…</div>}><LazyReports /></Suspense>}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <ProtectedRoutes />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
