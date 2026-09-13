import { formatMoney, pct, POLICY_CEILING_PCT, policyStatus } from "@/lib/deal-data";
import type { DealDetail, LineItemDetail } from "@/lib/api-types";

/** A short narrative assembled from the deal's own numbers: value, lines,
 * where the blended discount sits against the ceiling, the biggest line
 * and how it was decided, the confidence mix, and what this customer's
 * history says. Deterministic, so it can be quoted in an approval note or
 * an email without anyone re-checking it against the screen. */
export function composeDealSummary(
  deal: DealDetail,
  lineItems: LineItemDetail[],
  blended: number,
): string {
  const region = deal.deal.region;
  const total = lineItems.reduce((s, li) => s + li.lineItem.dealValue, 0);
  if (lineItems.length === 0) return `${deal.deal.name} has no line items yet.`;

  const policy = policyStatus(blended);
  const delta = Math.abs(POLICY_CEILING_PCT - blended).toFixed(1);
  const parts: string[] = [];

  parts.push(
    `${deal.deal.name} is a ${formatMoney(total, region)} deal across ${lineItems.length} ${
      lineItems.length === 1 ? "line" : "lines"
    } at a ${pct(blended)} blended discount, ${
      policy.status === "within"
        ? `${delta} pts under the ${POLICY_CEILING_PCT}% ceiling`
        : `${delta} pts over the ${POLICY_CEILING_PCT}% ceiling`
    }.`,
  );

  const largest = [...lineItems].sort((a, b) => b.lineItem.dealValue - a.lineItem.dealValue)[0]!;
  const applied = largest.lineItem.appliedDiscountPct ?? largest.recommendation.recommendedPct;
  const rec = largest.recommendation.recommendedPct;
  const largestState =
    largest.lineItem.lineApprovalState === "pending_approval"
      ? `has a proposed ${pct(largest.lineItem.pendingDiscountPct ?? 0)} awaiting manager approval`
      : largest.lineItem.decision === "pending"
        ? `is undecided at the AI's ${pct(rec)}`
        : Math.abs(applied - rec) < 0.05
          ? `is at the AI's recommended ${pct(rec)}`
          : `is at ${pct(applied)}, ${Math.abs(applied - rec).toFixed(1)} pts ${applied > rec ? "above" : "below"} the AI's ${pct(rec)}`;
  parts.push(
    `The largest line (${largest.lineItem.productCategory}, ${formatMoney(largest.lineItem.dealValue, region)}) ${largestState} with ${largest.recommendation.confidence} confidence.`,
  );

  const low = lineItems.filter((li) => li.recommendation.confidence === "low").length;
  if (low > 0) {
    parts.push(
      `${low} ${low === 1 ? "line has" : "lines have"} a low-confidence recommendation and ${low === 1 ? "was" : "were"} worth a closer look.`,
    );
  }

  const wins = deal.discountHistory.filter((h) => h.outcome === "won").map((h) => h.discountPct);
  const losses = deal.discountHistory.filter((h) => h.outcome === "lost").map((h) => h.discountPct);
  if (deal.discountHistory.length > 0) {
    if (wins.length > 0) {
      const lo = Math.min(...wins).toFixed(1);
      const hi = Math.max(...wins).toFixed(1);
      parts.push(
        `${deal.customer.name} has won ${wins.length} of ${deal.discountHistory.length} past deals${
          lo === hi ? ` at ${lo}%` : ` between ${lo}% and ${hi}%`
        }${losses.length > 0 ? `, and lost at ${losses.map((l) => `${l.toFixed(1)}%`).join(", ")}` : ""}.`,
      );
    } else {
      parts.push(`${deal.customer.name} has lost all ${losses.length} past deals with us.`);
    }
  } else {
    parts.push(`This is the first deal with ${deal.customer.name}.`);
  }

  if (deal.deal.approvalState === "approved") {
    parts.push(
      deal.deal.approvalNote
        ? `A manager approved it, noting: "${deal.deal.approvalNote}".`
        : "A manager has approved it.",
    );
  } else if (deal.deal.approvalState === "rejected") {
    parts.push(
      deal.deal.approvalNote
        ? `A manager sent it back: "${deal.deal.approvalNote}".`
        : "A manager sent it back for changes.",
    );
  }

  return parts.join(" ");
}

/** How much more discount, in money, the deal can absorb before the blended
 * rate crosses the ceiling. Negative when it is already over. */
export function roomUnderCeiling(lineItems: LineItemDetail[]): number {
  const total = lineItems.reduce((s, li) => s + li.lineItem.dealValue, 0);
  const discounted = lineItems.reduce((s, li) => {
    const applied = li.lineItem.appliedDiscountPct ?? li.recommendation.recommendedPct;
    return s + li.lineItem.dealValue * (applied / 100);
  }, 0);
  return (POLICY_CEILING_PCT / 100) * total - discounted;
}
