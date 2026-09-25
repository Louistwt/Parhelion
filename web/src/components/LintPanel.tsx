import { useQuery } from "@tanstack/react-query";
import { RefreshCwIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { api, LintResult } from "../api";
import { ErrorBox } from "./common";

export function LintPanel({ project }: { project: string }) {
  const q = useQuery({ queryKey: ["lint", project], queryFn: () => api.get<LintResult>(`/api/projects/${project}/lint`) });
  const r = q.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Checks</CardTitle>
        <CardDescription>Deterministic rules from CLAUDE.md{r ? ` — ${r.scope}` : ""}</CardDescription>
        <CardAction className="flex items-center gap-2">
          {r && <Badge variant={r.errors ? "destructive" : "success"}>{r.errors} error(s)</Badge>}
          {r && <Badge variant={r.warnings ? "warning" : "secondary"}>{r.warnings} warning(s)</Badge>}
          <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCwIcon className={q.isFetching ? "animate-spin" : ""} /> Re-run
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ErrorBox error={q.error} />
        {r && r.issues.length === 0 && <Alert variant="success"><AlertDescription>All checks pass.</AlertDescription></Alert>}
        {r && r.issues.length > 0 && (
          <Table>
            <TableBody>
              {r.issues.map((i, n) => (
                <TableRow key={n}>
                  <TableCell className="w-20"><Badge variant={i.level === "error" ? "destructive" : "warning"}>{i.level}</Badge></TableCell>
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
