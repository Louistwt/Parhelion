import { useQuery } from "@tanstack/react-query";
import { RefreshCwIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { api, LintResult } from "../api";
import { ErrorBox } from "./common";

export function LintPanel({ project }: { project: string }) {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ["lint", project], queryFn: () => api.get<LintResult>(`/api/projects/${project}/lint`) });
  const r = q.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("panels.lint.title")}</CardTitle>
        <CardDescription>{r ? t("panels.lint.descriptionScope", { scope: r.scope }) : t("panels.lint.description")}</CardDescription>
        <CardAction className="flex items-center gap-2">
          {r && <Badge variant={r.errors ? "destructive" : "success"}>{t("panels.lint.errors", { count: r.errors })}</Badge>}
          {r && <Badge variant={r.warnings ? "warning" : "secondary"}>{t("panels.lint.warnings", { count: r.warnings })}</Badge>}
          <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCwIcon className={q.isFetching ? "animate-spin" : ""} /> {t("panels.lint.rerun")}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ErrorBox error={q.error} />
        {r && r.issues.length === 0 && <Alert variant="success"><AlertDescription>{t("panels.lint.allPass")}</AlertDescription></Alert>}
        {r && r.issues.length > 0 && (
          <Table>
            <TableBody>
              {r.issues.map((i, n) => (
                <TableRow key={n}>
                  <TableCell className="w-20"><Badge variant={i.level === "error" ? "destructive" : "warning"}>{t(`panels.lint.levels.${i.level}`)}</Badge></TableCell>
                  <TableCell className="w-32 font-mono text-xs">{i.where}</TableCell>
                  <TableCell className="whitespace-normal">{i.message}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
