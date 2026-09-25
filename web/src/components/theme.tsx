import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const OPTIONS = [
  { value: "light", icon: SunIcon, label: "Light" },
  { value: "dark", icon: MoonIcon, label: "Dark" },
  { value: "system", icon: MonitorIcon, label: "System" },
] as const;

export function ThemeToggle() {
  const { theme = "system", setTheme } = useTheme();
  return (
    <div className="flex gap-0.5 rounded-lg border p-0.5">
      {OPTIONS.map((o) => (
        <Tooltip key={o.value}>
          <TooltipTrigger asChild>
            <Button
              variant={theme === o.value ? "secondary" : "ghost"}
              size="icon-xs"
              aria-label={o.label}
              aria-pressed={theme === o.value}
              onClick={() => setTheme(o.value)}
            >
              <o.icon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{o.label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
