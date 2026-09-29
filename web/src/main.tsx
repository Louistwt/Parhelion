import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CoinsIcon, FolderKanbanIcon, Settings2Icon, UsersIcon } from "lucide-react";
import { ThemeProvider } from "next-themes";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarInset,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import { StatusBar } from "./components/StatusBar";
import "./i18n";
import { JobsProvider } from "./jobs";
import { CharacterPage, Characters } from "./pages/Characters";
import { Costs } from "./pages/Costs";
import { Home } from "./pages/Home";
import { Project } from "./pages/Project";
import { SettingsPage } from "./pages/Settings";
import "./index.css";

const qc = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: true, retry: 1 } } });

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true" className="text-primary-mark">
      <circle cx="16" cy="16" r="6" fill="currentColor" />
      <circle cx="16" cy="16" r="10.5" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
      <circle cx="4" cy="16" r="2.5" fill="currentColor" />
      <circle cx="28" cy="16" r="2.5" fill="currentColor" />
    </svg>
  );
}

const NAV = [
  { to: "/", key: "projects", icon: FolderKanbanIcon, match: (p: string) => p === "/" || p.startsWith("/p/") },
  { to: "/characters", key: "characters", icon: UsersIcon, match: (p: string) => p.startsWith("/characters") },
  { to: "/costs", key: "costs", icon: CoinsIcon, match: (p: string) => p.startsWith("/costs") },
  { to: "/settings", key: "settings", icon: Settings2Icon, match: (p: string) => p.startsWith("/settings") },
] as const;

function AppSidebar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
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
                  <SidebarMenuButton asChild isActive={n.match(pathname)} className="data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold data-[active=true]:shadow-xs data-[active=true]:[&>svg]:text-primary-mark">
                    <NavLink to={n.to}><n.icon /> {t(`shell.nav.${n.key}`)}</NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

function NotFound() {
  const { t } = useTranslation();
  return <p>{t("common.notFound")} <Link className="font-medium text-primary-ink underline underline-offset-4" to="/">{t("common.goHome")}</Link></p>;
}

function Layout() {
  const { t } = useTranslation();
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger aria-label={t("shell.openMenu")} />
          <span className="font-semibold">Parhelion</span>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/p/:id" element={<Project />} />
            <Route path="/p/:id/:tab" element={<Project />} />
            <Route path="/characters" element={<Characters />} />
            <Route path="/characters/:name" element={<CharacterPage />} />
            <Route path="/costs" element={<Costs />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <StatusBar />
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
