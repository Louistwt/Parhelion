import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { CoinsIcon, FolderKanbanIcon, Settings2Icon, UsersIcon } from "lucide-react";
import { ThemeProvider } from "next-themes";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarInset,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { api, Overview } from "./api";
import { ThemeToggle } from "./components/theme";
import { useMoney } from "./format";
import { JobsProvider } from "./jobs";
import { Characters } from "./pages/Characters";
import { Costs } from "./pages/Costs";
import { Home } from "./pages/Home";
import { Project } from "./pages/Project";
import { SettingsPage } from "./pages/Settings";
import "./index.css";

const qc = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: true, retry: 1 } } });

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true" className="text-primary">
      <circle cx="16" cy="16" r="6" fill="currentColor" />
      <circle cx="16" cy="16" r="10.5" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
      <circle cx="4" cy="16" r="2.5" fill="currentColor" />
      <circle cx="28" cy="16" r="2.5" fill="currentColor" />
    </svg>
  );
}

const NAV = [
  { to: "/", label: "Projects", icon: FolderKanbanIcon, match: (p: string) => p === "/" || p.startsWith("/p/") },
  { to: "/characters", label: "Characters", icon: UsersIcon, match: (p: string) => p.startsWith("/characters") },
  { to: "/costs", label: "Costs", icon: CoinsIcon, match: (p: string) => p.startsWith("/costs") },
  { to: "/settings", label: "Settings", icon: Settings2Icon, match: (p: string) => p.startsWith("/settings") },
];

function AppSidebar() {
  const { pathname } = useLocation();
  const money = useMoney();
  const ov = useQuery({ queryKey: ["overview"], queryFn: () => api.get<Overview>("/api/overview"), refetchInterval: 5000 });
  const o = ov.data;
  const pct = o && o.monthly_budget ? Math.min(100, (100 * o.month_spend) / o.monthly_budget) : 0;
  return (
    <Sidebar>
      <SidebarHeader>
        <Link to="/" className="flex items-center gap-2 px-2 py-1.5 text-base font-semibold"><Logo /> Parhelion</Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((n) => (
                <SidebarMenuItem key={n.to}>
                  <SidebarMenuButton asChild isActive={n.match(pathname)}>
                    <NavLink to={n.to}><n.icon /> {n.label}</NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-3 text-xs text-muted-foreground">
        {o?.jobs_active && <Badge className="animate-pulse">● generating…</Badge>}
        {o && (
          <div className="flex flex-col gap-1.5 px-1">
            <div className="flex justify-between"><span>This month</span><span className="tabular-nums">{money(o.month_spend)} / {money(o.monthly_budget, 0)}</span></div>
            <Progress value={pct} className="h-1" />
            {!o.has_fal_key && <span className="text-destructive">FAL_KEY not set</span>}
          </div>
        )}
        <div className="flex items-center justify-between px-1">
          <span>Local only · 127.0.0.1</span>
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function Layout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
          <span className="font-semibold">Parhelion</span>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/p/:id" element={<Project />} />
            <Route path="/p/:id/:tab" element={<Project />} />
            <Route path="/characters" element={<Characters />} />
            <Route path="/costs" element={<Costs />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<p>Not found. <Link className="text-primary" to="/">Go home</Link></p>} />
          </Routes>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={qc}>
        <TooltipProvider>
          <JobsProvider>
            <BrowserRouter>
              <Layout />
              <Toaster richColors position="bottom-right" />
            </BrowserRouter>
          </JobsProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
