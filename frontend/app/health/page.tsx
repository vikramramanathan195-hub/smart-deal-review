"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TopNav } from "@/components/app/top-nav";
import { AccountMenu } from "@/components/app/account-menu";

const stats = [
  { label: "Concurrent Users", value: "1,284", delta: "+6.2% vs last hour" },
  { label: "Error Rate", value: "0.04%", delta: "−0.01 pts vs last hour" },
  { label: "Uptime (30d)", value: "99.98%", delta: "+0.02 pts vs prior 30d" },
];

const latencyPercentiles = [
  { label: "P50", value: "98 ms" },
  { label: "P95", value: "310 ms" },
  { label: "P99", value: "640 ms" },
];

const dealsPendingApproval = {
  value: "2",
  note: "Awaiting manager review",
};

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

const endpointStats = [
  { method: "GET", path: "/api/deals", requests: 1240, latencyMs: 42 },
  { method: "GET", path: "/api/deals/{id}", requests: 3860, latencyMs: 61 },
  { method: "POST", path: "/api/deals/{id}/line-items/{id}/decision", requests: 512, latencyMs: 88 },
  { method: "POST", path: "/api/deals/{id}/approval", requests: 96, latencyMs: 134 },
];

const recentEvents: { time: string; text: string; tone: "routine" | "warning" }[] = [
  { time: "14:52", text: "Deployment: v1.4.2 shipped", tone: "routine" },
  { time: "14:30", text: "Brief latency spike on /approval endpoint (auto-resolved)", tone: "warning" },
  { time: "13:58", text: "Scheduled backup completed", tone: "routine" },
  { time: "13:15", text: "Approval endpoint error rate briefly exceeded 1%", tone: "warning" },
  { time: "12:40", text: "New sales rep session started", tone: "routine" },
  { time: "11:05", text: "Cache warm-up completed after restart", tone: "routine" },
];

function StatCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="surface-card p-5 transition-shadow hover:shadow-card-hover">
      <p className="label-caps">{label}</p>
      {children}
    </div>
  );
}

export default function Health() {
  return (
    <div className="min-h-screen">
      <TopNav
        right={
          <>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-success-soft px-3 py-1.5 text-xs font-semibold text-success">
              <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-success text-success" />
              Live
            </span>
            <AccountMenu />
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

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Concurrent Users">
            <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
              {stats[0]!.value}
            </p>
            <p className="mt-2 text-xs font-medium text-success">{stats[0]!.delta}</p>
          </StatCard>

          <StatCard label="Response Time">
            <div className="mt-2 grid grid-cols-3 gap-2">
              {latencyPercentiles.map((p) => (
                <div key={p.label} className="rounded-lg border border-border bg-secondary/60 px-2 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {p.label}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums">{p.value}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs font-medium text-success">−18 ms vs last hour (p50)</p>
          </StatCard>

          <StatCard label="Error Rate">
            <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
              {stats[1]!.value}
            </p>
            <p className="mt-2 text-xs font-medium text-success">{stats[1]!.delta}</p>
          </StatCard>

          <StatCard label="Uptime (30d)">
            <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
              {stats[2]!.value}
            </p>
            <p className="mt-2 text-xs font-medium text-success">{stats[2]!.delta}</p>
          </StatCard>

          <StatCard label="Deals Pending Approval">
            <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
              {dealsPendingApproval.value}
            </p>
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              {dealsPendingApproval.note}
            </p>
          </StatCard>
        </div>

        <div className="surface-card p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Request Volume · Last Hour</h2>
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
                  formatter={(v) => [`${Number(v).toLocaleString()} req`, "Volume"]}
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

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="surface-card p-6 lg:col-span-2">
            <h2 className="text-sm font-semibold">Requests by Endpoint</h2>
            <p className="mt-1 text-xs text-muted-foreground">Last hour</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="label-caps pb-2 text-left font-semibold">Endpoint</th>
                    <th className="label-caps pb-2 text-right font-semibold">Requests</th>
                    <th className="label-caps pb-2 text-right font-semibold">Avg Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {endpointStats.map((e) => (
                    <tr key={e.path}>
                      <td className="py-3 pr-4">
                        <span className="font-mono text-[13px] font-semibold text-ai">{e.method}</span>{" "}
                        <span className="font-mono text-[13px] text-foreground">{e.path}</span>
                      </td>
                      <td className="py-3 text-right tabular-nums">{e.requests.toLocaleString()}</td>
                      <td className="py-3 text-right tabular-nums">{e.latencyMs} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="surface-card p-6">
            <h2 className="text-sm font-semibold">Recent Events</h2>
            <div className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-1">
              {recentEvents.map((ev, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span
                    className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${
                      ev.tone === "warning" ? "bg-warning" : "bg-muted-foreground/40"
                    }`}
                    aria-hidden="true"
                  />
                  <p className="text-[13px] leading-relaxed text-foreground">
                    <span className="tabular-nums text-muted-foreground">{ev.time}</span>
                    <span className="text-muted-foreground"> · </span>
                    {ev.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
