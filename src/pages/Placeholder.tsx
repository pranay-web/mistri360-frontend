import { ALL_LINKS } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";

export default function PlaceholderPage() {
  const [location] = useLocation();
  const currentRoute = ALL_LINKS.find((link) => location.startsWith(link.path));
  const title = currentRoute ? currentRoute.label : "Page";
  const Icon = currentRoute?.icon;

  return (
    <div className="flex h-[60vh] w-full items-center justify-center">
      <Card className="w-full max-w-md border-dashed border-2 bg-background/50">
        <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-4">
          {Icon && (
            <div className="rounded-full bg-primary/10 p-4">
              <Icon className="h-8 w-8 text-primary" />
            </div>
          )}
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          <p className="text-muted-foreground">
            This module is currently under construction and will be available in a future update.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
