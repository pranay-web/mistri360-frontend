import { Link } from "wouter";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex h-[80vh] w-full flex-col items-center justify-center space-y-4">
      <AlertCircle className="h-16 w-16 text-destructive" />
      <h1 className="text-4xl font-bold tracking-tighter">404</h1>
      <p className="text-lg text-muted-foreground text-center max-w-md">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/dashboard"
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 mt-4"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}