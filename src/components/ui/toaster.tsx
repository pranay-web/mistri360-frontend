// The app uses Sonner for toasts (see components/ui/sonner.tsx + App.tsx).
// This file is kept for compatibility; it delegates to useToast which wraps Sonner.
import { useToast } from "@/hooks/use-toast";

export function Toaster() {
  // Toasting is handled by Sonner <Toaster> in App.tsx.
  // This component is provided as a no-op fallback for any legacy imports.
  useToast(); // keep the hook in scope so tree-shaking doesn't remove the module
  return null;
}

export { useToast };
