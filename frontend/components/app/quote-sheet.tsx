import { formatMoney, pct, policyStatus, TERM_LENGTH_LABEL } from "@/lib/deal-data";
import { regionInfo } from "@/lib/fx-rates";
import type { DealDetail, LineItemDetail, Region } from "@/lib/api-types";

/** The printable quote. Hidden on screen and shown only for print, with
 * fixed black-on-white colors so it prints the same from dark mode. Every
 * screen element carries print:hidden, so ⌘P yields just this page. */
export function QuoteSheet({
  deal,
  lineItems,
  blended,
  region,
}: {
  deal: DealDetail;
  lineItems: LineItemDetail[];
  blended: number;
  region: Region;
}) {
  const total = lineItems.reduce((s, li) => s + li.lineItem.dealValue, 0);
  const totalNet = lineItems.reduce((s, li) => {
    const applied = li.lineItem.appliedDiscountPct ?? li.recommendation.recommendedPct;
    return s + li.lineItem.dealValue * (1 - applied / 100);
  }, 0);
  const policy = policyStatus(blended);
  const today = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="hidden bg-white p-12 font-sans text-black print:block">
      <div className="flex items-start justify-between border-b border-black/20 pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-black/60">Quote</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{deal.deal.name}</h1>
          <p className="mt-1 text-sm text-black/70">Prepared for {deal.customer.name}</p>
        </div>
        <div className="text-right text-sm text-black/70">
          <p>{today}</p>
          <p>
            {regionInfo(region).label} · {regionInfo(region).currencyCode}
          </p>
          <p>Term: {TERM_LENGTH_LABEL[deal.deal.termLength]}</p>
        </div>
      </div>

      <table className="mt-8 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-black/20 text-left text-xs font-semibold uppercase tracking-wider text-black/60">
            <th className="py-2 pr-4">#</th>
            <th className="py-2 pr-4">Line item</th>
            <th className="py-2 pr-4 text-right">List value</th>
            <th className="py-2 pr-4 text-right">Discount</th>
            <th className="py-2 text-right">Net</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((li, i) => {
            const applied = li.lineItem.appliedDiscountPct ?? li.recommendation.recommendedPct;
            const net = li.lineItem.dealValue * (1 - applied / 100);
            const status =
              li.lineItem.lineApprovalState === "pending_approval"
                ? " (proposed, awaiting approval)"
                : li.lineItem.decision === "pending"
                  ? " (recommended)"
                  : "";
            return (
              <tr key={li.lineItem.id} className="border-b border-black/10">
                <td className="py-3 pr-4 tabular-nums text-black/60">{i + 1}</td>
                <td className="py-3 pr-4">
                  {li.lineItem.productCategory}
                  <span className="text-black/50">{status}</span>
                </td>
                <td className="py-3 pr-4 text-right tabular-nums">
                  {formatMoney(li.lineItem.dealValue, region)}
                </td>
                <td className="py-3 pr-4 text-right tabular-nums">{pct(applied)}</td>
                <td className="py-3 text-right font-medium tabular-nums">{formatMoney(net, region)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} className="pt-4 text-xs font-semibold uppercase tracking-wider text-black/60">
              Totals
            </td>
            <td className="pt-4 text-right tabular-nums">{formatMoney(total, region)}</td>
            <td className="pt-4 text-right tabular-nums">{pct(blended)} blended</td>
            <td className="pt-4 text-right text-base font-semibold tabular-nums">
              {formatMoney(totalNet, region)}
            </td>
          </tr>
        </tfoot>
      </table>

      <p className="mt-8 text-sm text-black/70">
        {policy.status === "within"
          ? `Blended discount of ${pct(blended)} is within the standard pricing policy.`
          : deal.deal.approvalState === "approved"
            ? `Blended discount of ${pct(blended)} was approved by a manager.`
            : `Blended discount of ${pct(blended)} is subject to manager approval.`}
      </p>

      <p className="mt-12 text-xs text-black/50">
        Prepared with Deal Discount Review. Figures are in{" "}
        {regionInfo(region).currencyCode} and valid for 30 days from the date above.
      </p>
    </div>
  );
}
