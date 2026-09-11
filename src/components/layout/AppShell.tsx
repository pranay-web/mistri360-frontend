import { Link, useLocation } from "wouter";
import {
  useLogout,
  getGetMeQueryKey,
  type AuthUser,
  useGetUnreadNotificationCount,
  useListNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  getGetUnreadNotificationCountQueryKey,
  getListNotificationsQueryKey,
} from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Truck,
  Wrench,
  ClipboardCheck,
  AlertTriangle,
  ShieldCheck,
  BarChart3,
  LogOut,
  Menu,
  X,
  Bell,
  CheckCheck,
  ChevronRight,
  Building2,
  FileText,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mistri360Mark } from "@/components/layout/Mistri360Mark";

// ── Nav structure ─────────────────────────────────────────────────────────────

export const ALL_LINKS = [
  { path: "/dashboard",   label: "Overview",                 icon: LayoutDashboard, section: "FLEET MAINTENANCE" },
  { path: "/vehicles",    label: "Vehicles",                 icon: Truck,           section: "FLEET MAINTENANCE" },
  { path: "/work-orders", label: "Work Orders",              icon: Wrench,          section: "FLEET MAINTENANCE" },
  { path: "/customers",   label: "Customers",                icon: Building2,       section: "OPERATIONS" },
  { path: "/estimates",   label: "Estimates",                icon: FileText,         section: "OPERATIONS" },
  { path: "/checklists",  label: "Checklists",               icon: ClipboardCheck,  section: "OPERATIONS" },
  { path: "/defects",     label: "Defects",                  icon: AlertTriangle,   section: "OPERATIONS" },
  { path: "/compliance",  label: "Compliance",               icon: ShieldCheck,     section: "COMPLIANCE" },
  { path: "/reports",     label: "Reports",                  icon: BarChart3,       section: "COMPLIANCE" },
];

export const ROLE_ACCESS: Record<string, string[]> = {
  admin:    ["/dashboard", "/vehicles", "/work-orders", "/customers", "/estimates", "/checklists", "/defects", "/compliance", "/reports"],
  manager:  ["/dashboard", "/vehicles", "/work-orders", "/customers", "/estimates", "/checklists", "/defects", "/compliance", "/reports"],
  mechanic: ["/dashboard", "/vehicles", "/work-orders", "/customers", "/estimates", "/checklists", "/defects", "/compliance", "/reports"],
  driver:   ["/defects"],
};

const NAV_SECTIONS = ["FLEET MAINTENANCE", "OPERATIONS", "COMPLIANCE"] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

// ── Sidebar nav ───────────────────────────────────────────────────────────────

function SidebarNav({
  navLinks,
  location,
  onNavigate,
}: {
  navLinks: typeof ALL_LINKS;
  location: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-5">
      {NAV_SECTIONS.map((section) => {
        const links = navLinks.filter((l) => l.section === section);
        if (!links.length) return null;
        return (
          <div key={section}>
            <p className="px-2 mb-1.5 text-[10px] font-semibold tracking-widest uppercase"
               style={{ color: "hsl(220 18% 38%)" }}>
              {section}
            </p>
            <ul className="space-y-0.5">
              {links.map((link) => {
                const Icon = link.icon;
                const isActive = location.startsWith(link.path);
                return (
                  <li key={link.path}>
                    <Link
                      href={link.path}
                      onClick={onNavigate}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 select-none",
                        isActive
                          ? "text-white"
                          : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
                      )}
                      style={isActive ? { background: "hsl(218 16% 22%)" } : undefined}
                    >
                      {/* Gold left accent bar */}
                      <span
                        className={cn(
                          "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full transition-all duration-150",
                          isActive ? "h-5 opacity-100" : "h-0 opacity-0"
                        )}
                        style={{ background: "hsl(38 78% 52%)" }}
                      />

                      {/* Icon container */}
                      <span
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-md shrink-0 transition-colors",
                          isActive
                            ? ""
                            : "group-hover:bg-white/5"
                        )}
                        style={isActive ? { background: "hsl(38 78% 52% / 0.2)" } : undefined}
                      >
                        <Icon
                          className="h-4 w-4"
                          style={isActive ? { color: "hsl(38 78% 58%)" } : undefined}
                        />
                      </span>

                      <span className="flex-1 truncate">{link.label}</span>

                      {isActive && (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-40" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

// ── User profile card (sidebar bottom) ───────────────────────────────────────

function SidebarUser({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const initials = getInitials(user.name);
  return (
    <div className="p-3 border-t" style={{ borderColor: "hsl(216 18% 34%)" }}>
      <div
        className="flex items-center gap-3 rounded-xl p-3"
        style={{ background: "hsl(216 22% 20%)" }}
      >
        {/* Avatar */}
        <div
          className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{ background: "hsl(38 78% 52% / 0.2)", color: "hsl(38 78% 62%)", border: "1px solid hsl(38 78% 52% / 0.35)" }}
        >
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: "hsl(220 25% 90%)" }}>
            {user.name}
          </p>
          <p className="text-xs capitalize" style={{ color: "hsl(220 14% 50%)" }}>
            {user.role === "admin" ? "Administrator" : user.role === "manager" ? "Maintenance Manager" : user.role === "driver" ? "Defect Reporter" : user.role.charAt(0).toUpperCase() + user.role.slice(1)}
          </p>
        </div>

        <button
          onClick={onLogout}
          title="Sign out"
          className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4" style={{ color: "hsl(220 14% 50%)" }} />
        </button>
      </div>
    </div>
  );
}

// ── Notification panel ────────────────────────────────────────────────────────

function NotificationPanel({
  unreadCount,
  notifications,
  onMarkRead,
  onMarkAllRead,
}: {
  unreadCount: number;
  notifications: any[];
  onMarkRead: (id: number) => void;
  onMarkAllRead: () => void;
}) {
  return (
    <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">Notifications</span>
          {unreadCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <CheckCheck className="h-3 w-3" />
            Mark all read
          </button>
        )}
      </div>
      <ul className="max-h-72 overflow-y-auto divide-y divide-border/50">
        {notifications.length === 0 ? (
          <li className="py-10 text-center">
            <Bell className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No notifications yet</p>
          </li>
        ) : (
          notifications.map((n: any) => (
            <li
              key={n.id}
              className={`px-4 py-3 flex gap-3 items-start cursor-pointer hover:bg-muted/30 transition-colors ${!n.isRead ? "bg-primary/5" : ""}`}
              onClick={() => { if (!n.isRead) onMarkRead(n.id); }}
            >
              <span className={cn("mt-1.5 h-2 w-2 rounded-full shrink-0", !n.isRead ? "bg-primary" : "bg-transparent")} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{n.title}</p>
                {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  {new Date(n.createdAt).toLocaleDateString()}
                </p>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

// ── Main AppShell ─────────────────────────────────────────────────────────────

export function AppShell({ user, children }: { user: AuthUser & { companyName?: string }; children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const logout = useLogout();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.removeQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/login");
      },
    });
  };

  const allowedPaths = ROLE_ACCESS[user.role] || [];
  const navLinks = ALL_LINKS.filter((link) => allowedPaths.includes(link.path));

  const currentRoute = ALL_LINKS.find((link) => location.startsWith(link.path));
  const pageTitle = currentRoute ? currentRoute.label : "";
  const PageIcon = currentRoute?.icon;

  const { data: unreadData } = useGetUnreadNotificationCount({
    query: { queryKey: getGetUnreadNotificationCountQueryKey(), refetchInterval: 30_000 },
  });
  const { data: notifications = [] } = useListNotifications({
    query: { queryKey: getListNotificationsQueryKey(), enabled: notifOpen },
  });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const unreadCount = (unreadData as any)?.count ?? 0;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    if (notifOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);

  const initials = getInitials(user.name);

  const today = new Date().toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="flex min-h-[100dvh] w-full bg-background text-foreground">

      {/* ── Desktop Sidebar ──────────────────────────────────────────────── */}
      <aside
        className="hidden w-64 flex-col md:flex shrink-0"
        style={{ background: "hsl(216 24% 24%)", borderRight: "1px solid hsl(216 18% 34%)" }}
      >
        {/* Logo block */}
        <div
          className="flex flex-col items-center justify-center gap-2 py-6 px-4"
          style={{ borderBottom: "1px solid hsl(216 18% 34%)" }}
        >
          <Mistri360Mark onDark />
          <div className="text-center">
            <p className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: "hsl(38 78% 52%)" }} data-testid="text-company-name">
              {user.companyName || "Company Workspace"}
            </p>
          </div>
        </div>

        {/* Nav */}
        <SidebarNav navLinks={navLinks} location={location} />

        {/* User profile */}
        <SidebarUser user={user} onLogout={handleLogout} />
      </aside>

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">

        {/* ── Topbar ─────────────────────────────────────────────────────── */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm px-4 md:px-6 shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              className="md:hidden h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Page title */}
            <div className="flex items-center gap-2">
              {PageIcon && (
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 shrink-0">
                  <PageIcon className="h-4 w-4 text-primary" />
                </span>
              )}
              <h1 className="text-sm font-semibold text-foreground tracking-tight">{pageTitle}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Date chip */}
            <span className="hidden sm:inline-flex items-center rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground font-medium">
              {today}
            </span>

            {/* Notification bell */}
            <div ref={notifRef} className="relative">
              <button
                className="relative h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
                onClick={() => setNotifOpen(!notifOpen)}
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4 text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white leading-none">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <NotificationPanel
                  unreadCount={unreadCount}
                  notifications={notifications as any[]}
                  onMarkRead={(id) => markRead.mutate({ id })}
                  onMarkAllRead={() => markAllRead.mutate(undefined)}
                />
              )}
            </div>

            {/* Divider */}
            <div className="hidden sm:block h-5 w-px bg-border" />

            {/* User pill */}
            <div className="hidden sm:flex items-center gap-2.5">
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                style={{ background: "hsl(222 62% 26%)", color: "#fff" }}
              >
                {initials}
              </div>
              <div className="flex flex-col items-start leading-tight">
                <span className="text-xs font-semibold text-foreground">{user.name}</span>
                <span className="text-[10px] text-muted-foreground">{user.role === "driver" ? "Defect Reporter" : user.role}</span>
              </div>
            </div>
          </div>
        </header>

        {/* ── Mobile Sidebar Overlay ──────────────────────────────────────── */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div
              className="fixed inset-y-0 left-0 z-50 flex flex-col w-72 shadow-2xl"
              style={{ background: "hsl(216 24% 24%)", borderRight: "1px solid hsl(216 18% 34%)" }}
            >
              {/* Mobile header */}
              <div
                className="flex items-center justify-between px-4 py-5"
                style={{ borderBottom: "1px solid hsl(216 18% 34%)" }}
              >
                <Mistri360Mark onDark />
                <button
                  className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <X className="h-5 w-5 text-sidebar-foreground" />
                </button>
              </div>

              <SidebarNav
                navLinks={navLinks}
                location={location}
                onNavigate={() => setIsMobileMenuOpen(false)}
              />

              <SidebarUser user={user} onLogout={handleLogout} />
            </div>
          </div>
        )}

        {/* ── Page content ─────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
