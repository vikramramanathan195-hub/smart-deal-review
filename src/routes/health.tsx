import { createFileRoute } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RolePill, TopNav } from "@/components/app/top-nav";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/health")({
  head: () => ({
    meta: [
      { title: "System Health · Deal Discount Review" },
      {
        name: "description",
        content:
          "Live operational health for Deal Discount Review: concurrent users, response time, error rate, uptime, and request volume.",
      },
      { property: "og:title", content: "System Health · Deal Discount Review" },
      {
        property: "og:description",
        content: "Live service metrics and request volume for the discount review tool.",
      },
    ],
  }),
  component: Health,
});

const stats = [
  { label: "Concurrent Users", value: "1,284", delta: "+6.2% vs last hour" },
  { label: "Avg Response Time", value: "142 ms", delta: "−18 ms vs last hour" },
  { label: "Error Rate", value: "0.04%", delta: "−0.01 pts vs last hour" },
  { label: "Uptime (30d)", value: "99.98%", delta: "+0.02 pts vs prior 30d" },
];

const series = [
  { t: "15:05", v: 3120 },
  { t: "15:10", v: 3480 },
  { t: "15:15", v: 3305 },
  { t: "15:20", v: 3890 },
  { t: "15:25", v: 4260 },
  { t: "15:30", v: 4105 },
  { t: "15:35", v: 4620 },
  { t: "15:40", v: 5010 },
  { t: "15:45", v: 4780 },
  { t: "15:50", v: 5240 },
  { t: "15:55", v: 5605 },
  { t: "16:00", v: 5390 },
];

function Health() {
  const { role } = useSession();

  return (
    <div className="min-h-screen">
      <TopNav
        right={
          <>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-success-soft px-3 py-1.5 text-xs font-semibold text-success">
              <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-success text-success" />
              Live
            </span>
            <RolePill role={role} />
          </>
        }
      />

      <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-8">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">System Health</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Operational metrics for the discount review service.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="surface-card p-5 transition-shadow hover:shadow-card-hover"
            >
              <p className="label-caps">{s.label}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{s.value}</p>
              <p className="mt-2 text-xs font-medium text-success">{s.delta}</p>
            </div>
          ))}
        </div>

        <div className="surface-card p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Request Volume — Last Hour</h2>
            <p className="text-xs text-muted-foreground tabular-nums">
              Peak 5,605 req/5min · 52,805 total
            </p>
          </div>
          <div className="mt-5 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="volume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-ai)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--color-ai)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="t"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid var(--color-border)",
                    fontSize: 12,
                    boxShadow: "var(--shadow-card-hover)",
                  }}
                  formatter={(v: number) => [`${v.toLocaleString()} req`, "Volume"]}
                />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="var(--color-ai)"
                  strokeWidth={2}
                  fill="url(#volume)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>
    </div>
  );
}
