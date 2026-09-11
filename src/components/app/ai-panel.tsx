import { Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  currency,
  pct,
  type Confidence,
  type Factor,
  type LineItem,
  type Recommendation,
} from "@/lib/deal-data";

function ConfidenceBadge({ level }: { level: Confidence }) {
  const map = {
    high: { cls: "bg-success-soft text-success", dot: "bg-success", text: "High confidence" },
    medium: { cls: "bg-warning-soft text-warning-foreground", dot: "bg-warning", text: "Medium confidence" },
    low: { cls: "bg-danger-soft text-danger", dot: "bg-danger", text: "Low confidence" },
  }[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${map.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${map.dot}`} />
      {map.text}
    </span>
  );
}

function PanelCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">{children}</div>
  );
}

function FactorRow({ factor, max }: { factor: Factor; max: number }) {
  const negative = factor.value < 0;
  const width = Math.max(4, (Math.abs(factor.value) / max) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-foreground">{factor.name}</span>
        <span
          className={`text-[13px] font-semibold tabular-nums ${negative ? "text-danger" : "text-success"}`}
        >
          {negative ? "−" : factor.name.startsWith("Baseline") ? "" : "+"}
          {Math.abs(factor.value).toFixed(1)}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${negative ? "bg-danger" : "bg-ai"}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/60 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function AiPanelSkeleton() {
  return (
    <PanelShell>
      <div className="grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <PanelCard key={i}>
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-4 h-10 w-24" />
            <Skeleton className="mt-3 h-3 w-40" />
            <Skeleton className="mt-4 h-8 w-full" />
            <Skeleton className="mt-2 h-8 w-full" />
            <Skeleton className="mt-2 h-8 w-2/3" />
          </PanelCard>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Generating recommendation…</p>
    </PanelShell>
  );
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-ai-softer p-5 pl-6">
      <span className="absolute inset-y-0 left-0 w-1 bg-ai" aria-hidden="true" />
      <div className="mb-4 flex items-center gap-2.5">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ai text-ai-foreground">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <h4 className="text-sm font-semibold text-foreground">AI Discount Recommendation</h4>
      </div>
      {children}
    </div>
  );
}

export function AiPanel({
  line,
  recommendation,
  readOnly,
  onAccept,
  onAdjust,
  onOverride,
  onDiscountChange,
}: {
  line: LineItem;
  recommendation: Recommendation;
  readOnly: boolean;
  onAccept: () => void;
  onAdjust: () => void;
  onOverride: () => void;
  onDiscountChange: (discount: number | null) => void;
}) {
  const value = typeof line.value === "number" ? line.value : 0;
  const applied = line.appliedDiscount ?? recommendation.discount;
  const net = value * (1 - applied / 100);
  const maxFactor = Math.max(...recommendation.factors.map((f) => Math.abs(f.value)));
  const total = recommendation.factors.reduce((s, f) => s + f.value, 0);
  const maxHistory = Math.max(...recommendation.customer.history.map((h) => h.discount));

  return (
    <PanelShell>
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Column 1 */}
        <PanelCard>
          <p className="label-caps">Recommended discount</p>
          <p className="mt-1 text-5xl font-semibold tracking-tight tabular-nums">
            {pct(recommendation.discount)}
          </p>
          <p className="mt-2 text-[13px] text-muted-foreground tabular-nums">
            Net: {currency(net)} on {currency(value)}
          </p>
          <div className="mt-3">
            <ConfidenceBadge level={recommendation.confidence} />
          </div>

          <div className="my-5 h-px bg-border" />

          <p className="label-caps">Your decision</p>
          {readOnly ? (
            <p className="mt-2 text-[13px] text-muted-foreground">
              Read-only — reps own line-level decisions.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              <Button className="w-full" onClick={onAccept}>
                {line.decision === "accepted"
                  ? `Accepted ${pct(applied)}`
                  : `Accept ${pct(recommendation.discount)}`}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={onAdjust}>
                  Adjust
                </Button>
                <Button variant="outline" onClick={onOverride}>
                  Override
                </Button>
              </div>
            </div>
          )}
          {line.decision !== "pending" && (
            <p className="mt-3 text-xs font-medium text-ai">
              Applied {pct(applied)} · {line.decision}
            </p>
          )}
        </PanelCard>

        {/* Column 2 */}
        <PanelCard>
          <h5 className="text-sm font-semibold">Why this number</h5>
          <p className="mt-1 text-xs text-muted-foreground">
            Each factor below adjusts the baseline discount.
          </p>
          <div className="mt-4 space-y-3.5">
            {recommendation.factors.map((f) => (
              <FactorRow key={f.name} factor={f} max={maxFactor} />
            ))}
          </div>
          <div className="my-4 h-px bg-border" />
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium">Final recommendation</span>
            <span className="text-base font-semibold tabular-nums">{pct(Math.round(total * 10) / 10)}</span>
          </div>
        </PanelCard>

        {/* Column 3 */}
        <PanelCard>
          <h5 className="text-sm font-semibold">Customer context</h5>
          <p className="mt-1 text-xs text-muted-foreground">
            {recommendation.customer.name} · Partner since {recommendation.customer.partnerSince}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <StatBox label="Lifetime" value={recommendation.customer.lifetimeValue} />
            <StatBox label="Renewal" value={recommendation.customer.renewalRate} />
            <StatBox label="Avg disc." value={pct(recommendation.customer.avgDiscount)} />
          </div>

          <p className="label-caps mt-5">Discount history</p>
          <div className="mt-2.5 space-y-2.5">
            {recommendation.customer.history.map((h) => (
              <div key={h.date} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-xs text-muted-foreground">{h.date}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${h.outcome === "Won" ? "bg-success" : "bg-danger"}`}
                    style={{ width: `${(h.discount / maxHistory) * 100}%` }}
                  />
                </div>
                <span className="w-11 shrink-0 text-right text-xs font-semibold tabular-nums">
                  {h.discount.toFixed(1)}%
                </span>
                <span
                  className={`w-8 shrink-0 text-right text-xs font-semibold ${h.outcome === "Won" ? "text-success" : "text-danger"}`}
                >
                  {h.outcome}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5 flex gap-2.5 rounded-lg bg-warning-soft p-3">
            <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-warning text-[10px] font-bold text-primary-foreground">
              !
            </span>
            <p className="text-xs leading-relaxed text-warning-foreground">
              {recommendation.customer.callout}
            </p>
          </div>
        </PanelCard>
      </div>
    </PanelShell>
  );
}

export function AiPanelEmpty() {
  return (
    <PanelShell>
      <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
        <AlertTriangle className="h-4 w-4 text-warning" />
        Pick a product category and enter a deal value to get a recommendation.
      </div>
    </PanelShell>
  );
}
