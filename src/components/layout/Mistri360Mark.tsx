import { cn } from "@/lib/utils";

export function Mistri360Mark({
  compact = false,
  onDark = false,
  className,
}: {
  compact?: boolean;
  onDark?: boolean;
  className?: string;
}) {
  const logoFile = compact ? "mistri360-icon.png" : onDark ? "mistri360-logo-dark.png" : "mistri360-logo.png";
  const logoSrc = `${import.meta.env.BASE_URL}brand/${logoFile}`;
  return (
    <div
      className={cn("flex items-center", compact ? "w-12 justify-center" : "w-[190px]", className)}
      data-testid="brand-mistri360"
      aria-label="mistri360 — A Trevion Technologies Product"
    >
      <img
        src={logoSrc}
        alt="mistri360 — A Trevion Technologies Product"
        className={compact ? "h-8 w-auto" : "h-auto w-full"}
      />
    </div>
  );
}