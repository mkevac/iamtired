import { Switch, Route, Router, Link, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Timer, History, BarChart3, Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/useTheme";
import TimerPage from "@/pages/timer";
import HistoryPage from "@/pages/history";
import StatsPage from "@/pages/stats";
import NotFound from "@/pages/not-found";

function Logo() {
  return (
    <div className="flex items-center gap-2" data-testid="brand-logo">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="13" r="8.5" stroke="hsl(var(--primary))" strokeWidth="2" />
        <path d="M12 13V8" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 13l3.5 1.8" stroke="hsl(var(--break))" strokeWidth="2" strokeLinecap="round" />
        <rect x="9" y="2.5" width="6" height="2.6" rx="1.3" fill="hsl(var(--primary))" />
      </svg>
      <span className="font-bold tracking-tight text-[15px]">iamtired</span>
    </div>
  );
}

const NAV = [
  { path: "/", label: "Timer", icon: Timer },
  { path: "/history", label: "History", icon: History },
  { path: "/stats", label: "Stats", icon: BarChart3 },
];

function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <div className="mx-auto max-w-2xl w-full px-4 h-14 flex items-center justify-between">
          <Logo />
          <button
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            data-testid="button-theme-toggle"
            className="size-9 grid place-items-center rounded-md hover-elevate text-muted-foreground"
          >
            {theme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
          </button>
        </div>
      </header>

      <main className="flex-1 w-full mx-auto max-w-2xl px-4 pb-28 pt-5">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 z-20 border-t border-border bg-background/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-2xl flex">
          {NAV.map(({ path, label, icon: Icon }) => {
            const active = location === path;
            return (
              <Link
                key={path}
                href={path}
                data-testid={`nav-${label.toLowerCase()}`}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[12px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 2} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function AppRouter() {
  return (
    <Shell>
      <Switch>
        <Route path="/" component={TimerPage} />
        <Route path="/history" component={HistoryPage} />
        <Route path="/stats" component={StatsPage} />
        <Route component={NotFound} />
      </Switch>
    </Shell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
