import type { Region } from "@/lib/api-types";

/** Which currency and locale a region's deals are priced/displayed in. */
export const REGIONS: {
  value: Region;
  label: string;
  currencyCode: string;
  locale: string;
}[] = [
  { value: "north_america", label: "North America", currencyCode: "USD", locale: "en-US" },
  { value: "uk", label: "United Kingdom", currencyCode: "GBP", locale: "en-GB" },
  { value: "eurozone", label: "Eurozone", currencyCode: "EUR", locale: "de-DE" },
  { value: "japan", label: "Japan", currencyCode: "JPY", locale: "ja-JP" },
  { value: "india", label: "India", currencyCode: "INR", locale: "en-IN" },
  { value: "brazil", label: "Brazil", currencyCode: "BRL", locale: "pt-BR" },
];

export function regionInfo(region: Region) {
  return REGIONS.find((r) => r.value === region) ?? REGIONS[0]!;
}

/** Just the currency symbol ("€", "¥", "₹"…) for prefixing an editable
 * number input — full Intl.NumberFormat output isn't usable there since an
 * input holds a raw number, not a formatted string. */
export function currencySymbol(region: Region): string {
  const { currencyCode, locale } = regionInfo(region);
  const part = new Intl.NumberFormat(locale, { style: "currency", currency: currencyCode })
    .formatToParts(0)
    .find((p) => p.type === "currency");
  return part?.value ?? currencyCode;
}

/**
 * Mocked FX rate table — units of each currency per 1 USD. Not live data;
 * this is a static snapshot, refreshed by hand, same as every other mocked
 * metric in this app (see app/health/page.tsx). Plausible rates, not
 * accurate-as-of-right-now ones.
 */
export const FX_RATES_TO_USD: Record<string, number> = {
  USD: 1,
  GBP: 0.79,
  EUR: 0.92,
  JPY: 149.5,
  INR: 83.1,
  BRL: 5.4,
};

/** When this snapshot was last synced — shown wherever a USD-equivalent
 * figure is displayed, so it reads as "last synced," not live. */
export const FX_RATES_AS_OF = "2026-09-10T09:00:00Z";

export function formatFxAsOf(): string {
  return new Date(FX_RATES_AS_OF).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/** Convert an amount in `region`'s native currency to its USD equivalent. */
export function toUsd(amount: number, region: Region): number {
  const { currencyCode } = regionInfo(region);
  const rate = FX_RATES_TO_USD[currencyCode] ?? 1;
  return amount / rate;
}
