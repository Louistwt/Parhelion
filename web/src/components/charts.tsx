import { Bar } from "../api";

export function BarList({ rows, fmt }: { rows: Bar[]; fmt: (v: number) => string }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No spend yet.</p>;
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[minmax(90px,36%)_1fr_auto] items-center gap-2 text-sm" title={`${r.label}: ${fmt(r.value)}`}>
          <span className="truncate text-muted-foreground">{r.label}</span>
          <span><span className="block h-3 min-w-0.5 rounded-r bg-chart-1" style={{ width: `${r.pct}%` }} /></span>
          <span className="tabular-nums">{fmt(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Daily spend columns (single series → no legend; hover shows the value). */
export function DayColumns({ cols, peak, fmt }: { cols: { day: string; value: number }[]; peak: number; fmt: (v: number) => string }) {
  if (peak <= 0) return <p className="text-sm text-muted-foreground">No spend in the last 30 days.</p>;
  const w = 600, h = 150, padL = 44, padB = 18, padT = 8;
  const slot = (w - padL) / cols.length;
  const bw = Math.max(2, slot - 2);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Daily spend, last 30 days">
      <g className="fill-muted-foreground text-[10px]">
        <text x={padL - 4} y={padT + 4} textAnchor="end">{fmt(peak)}</text>
        <text x={padL - 4} y={h - padB} textAnchor="end">0</text>
        <text x={padL} y={h - 4}>{cols[0]?.day}</text>
        <text x={w} y={h - 4} textAnchor="end">{cols[cols.length - 1]?.day}</text>
      </g>
      <line className="stroke-border" x1={padL} x2={w} y1={padT} y2={padT} />
      <line className="stroke-border" x1={padL} x2={w} y1={h - padB} y2={h - padB} />
      {cols.map((c, i) => {
        const bh = ((h - padB - padT) * c.value) / peak;
        if (bh <= 0) return null;
        return (
          <rect key={c.day} className="fill-chart-1 hover:opacity-75" x={padL + i * slot + 1} y={h - padB - bh} width={bw} height={bh} rx={Math.min(2, bw / 2)}>
            <title>{`${c.day}: ${fmt(c.value)}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
