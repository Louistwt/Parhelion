import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const OPTIONS = [
  { value: "light", icon: SunIcon },
  { value: "dark", icon: MoonIcon },
  { value: "system", icon: MonitorIcon },
] as const;

export function ThemeToggle() {
  const { t } = useTranslation();
  const { theme = "system", setTheme } = useTheme();
  return (
    <div className="flex gap-0.5 rounded-md border bg-background p-0.5" role="group" aria-label={t("shell.theme.label")}>
      {OPTIONS.map((o) => (
        <Tooltip key={o.value}>
          <TooltipTrigger asChild>
            <Button
              variant={theme === o.value ? "secondary" : "ghost"}
              size="icon-xs"
              aria-label={t(`shell.theme.${o.value}`)}
              aria-pressed={theme === o.value}
              onClick={() => setTheme(o.value)}
            >
              <o.icon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t(`shell.theme.${o.value}`)}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
