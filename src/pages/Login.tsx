import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useLocation } from "wouter";
import { useLogin, getGetMeQueryKey } from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Gauge, Wrench, ArrowRight, LockKeyhole } from "lucide-react";
import { Link } from "wouter";
import { Mistri360Mark } from "@/components/layout/Mistri360Mark";

const loginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login({ platformMode = false }: { platformMode?: boolean }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMutation = useLogin();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  function onSubmit(data: LoginFormValues) {
    loginMutation.mutate(
      { data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setLocation(platformMode ? "/platform" : "/dashboard");
        },
        onError: (error) => {
          const apiError = error as unknown as { response?: { data?: { error?: string } } };
          toast({
            variant: "destructive",
            title: "Login Failed",
            description: apiError?.response?.data?.error || "Invalid credentials. Please try again.",
          });
        },
      }
    );
  }

  return (
    <div className="min-h-[100dvh] w-full flex">
      {/* ── Left brand panel ──────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] flex-col relative overflow-hidden border-r border-white/10 bg-black">
        {/* Precise Operations Center Background Elements */}

        {/* Deep architectural radial glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute -top-[20%] -right-[10%] w-[70%] aspect-square rounded-full opacity-[0.16] blur-[100px]"
            style={{ background: "radial-gradient(circle, hsl(222 62% 40%) 0%, transparent 70%)" }}
          />
          <div
            className="absolute -bottom-[20%] -left-[10%] w-[60%] aspect-square rounded-full opacity-[0.12] blur-[100px]"
            style={{ background: "radial-gradient(circle, #63C841 0%, transparent 70%)" }}
          />
        </div>

        {/* Technical dot/line grid for 'precision' feel */}
        <div
          className="absolute inset-0 opacity-[0.045] pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, #ffffff 1px, transparent 1px),
              linear-gradient(to bottom, #ffffff 1px, transparent 1px)
            `,
            backgroundSize: "32px 32px"
          }}
        />

        {/* Subtle vignette/border shadows */}
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_120px_rgba(0,0,0,0.8)]" />

        {/* Content Container */}
        <div className="relative z-10 flex flex-col justify-between h-full px-12 py-12 xl:px-20 xl:py-16">
          {/* Logo */}
          <div className="flex items-center">
            <Mistri360Mark onDark />
          </div>

          {/* Main headline & features */}
          <div className="w-full max-w-[36rem] mt-auto mb-auto pt-8">
            <h1 className="font-serif text-[2.9rem] xl:text-[3.7rem] font-semibold leading-[1.06] tracking-[-0.025em] text-white mb-6">
              Fleet maintenance,<br />
              <span
                className="text-transparent bg-clip-text"
                style={{ backgroundImage: "linear-gradient(90deg, #9BEA72, #63C841)" }}
              >
                made intelligent.
              </span>
            </h1>
            <p className="text-lg text-slate-300 mb-10 font-normal leading-relaxed">
              The precision platform for transportation teams. Monitor, dispatch, and track compliance from a unified operations center.
            </p>

            {/* Feature layout - sharp glass cards */}
            <div className="grid gap-4">
              {[
                { icon: Gauge, title: "Real-time fleet monitoring", desc: "Track PM schedules & telemetry" },
                { icon: Wrench, title: "Work order management", desc: "Automate mechanic dispatching" },
                { icon: ShieldCheck, title: "PMCVI compliance", desc: "Automated reporting & tracking" },
              ].map(({ icon: Icon, title, desc }, i) => (
                <div key={i} className="group relative flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 transition-all hover:border-emerald-400/30 hover:bg-white/[0.07] overflow-hidden">
                  {/* Subtle hover accent line */}
                  <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-[hsl(38,78%,52%)] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10">
                    <Icon className="h-5 w-5 text-emerald-400" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-[0.95rem] font-semibold text-slate-100">{title}</h3>
                    <p className="text-sm text-slate-400 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-white/10 pt-8 mt-12">
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} mistri360 · A Trevion Technologies Product
            </p>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
              <LockKeyhole className="h-3.5 w-3.5 text-emerald-500" />
              Secure workspace access
            </div>
          </div>
        </div>
      </div>

      {/* ── Right form panel ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-6 py-12 sm:px-10 lg:px-16">
        {/* Mobile-only logo */}
        <div className="lg:hidden flex flex-col items-center mb-10 space-y-2">
          <Mistri360Mark />
          <p className="text-sm text-muted-foreground text-center">
              Fleet Operations &amp; Maintenance Platform
          </p>
        </div>

        <div className="w-full max-w-sm space-y-8">
          {/* Heading */}
          <div>
            <h2
              className="text-3xl font-semibold text-foreground"
            >
              {platformMode ? "Platform Admin Sign In" : "Sign In"}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {platformMode ? "Use your mistri360 platform administrator credentials." : "Enter your credentials to access your company workspace."}
            </p>
          </div>

          {/* Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Email address</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="name@company.com"
                        autoComplete="email"
                        className="h-11"
                        {...field}
                        data-testid="input-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="h-11"
                        {...field}
                        data-testid="input-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold mt-2"
                disabled={loginMutation.isPending}
                data-testid="button-submit-login"
              >
                {loginMutation.isPending ? "Signing in…" : "Sign In"}
              </Button>
            </form>
          </Form>

          <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
            <LockKeyhole className="mx-auto mb-1.5 h-4 w-4 text-primary" />
            <p className="text-xs text-muted-foreground">
              {platformMode ? "Not a platform administrator? " : "mistri360 platform administrator? "}
              <Link href={platformMode ? "/login" : "/platform-login"} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline" data-testid="link-platform-login">
                {platformMode ? "Company sign in" : "Platform sign in"} <ArrowRight className="h-3 w-3" />
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
