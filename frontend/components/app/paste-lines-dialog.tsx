"use client";

import { useMemo, useState } from "react";
import { ClipboardPaste, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PRODUCT_CATEGORIES } from "@/lib/deal-data";
import type { ProductCategory } from "@/lib/api-types";

export type ParsedLine = { productCategory: ProductCategory; dealValue: number };

/** Accepts the shapes people actually paste: "Compute 180000",
 * "Storage, 96,500", "networking\t65k", "Services: 1.2m". Category matches
 * by prefix so "comp" and "COMPUTE" both work; k/m suffixes scale. */
export function parseLines(text: string): { rows: ParsedLine[]; errors: string[] } {
  const rows: ParsedLine[] = [];
  const errors: string[] = [];
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line, i) => {
      const m = line.match(/^([A-Za-z][A-Za-z ]*?)\s*[,:\t|]?\s*\$?\s*([\d][\d.,]*)\s*([kKmM])?\b/);
      if (!m) {
        errors.push(`Line ${i + 1}: couldn't read "${line}"`);
        return;
      }
      const catText = m[1]!.trim().toLowerCase();
      const category = PRODUCT_CATEGORIES.find((c) => c.toLowerCase().startsWith(catText));
      if (!category) {
        errors.push(`Line ${i + 1}: "${m[1]!.trim()}" isn't a product category`);
        return;
      }
      let value = Number(m[2]!.replace(/,/g, ""));
      const suffix = m[3]?.toLowerCase();
      if (suffix === "k") value *= 1_000;
      if (suffix === "m") value *= 1_000_000;
      if (!Number.isFinite(value) || value <= 0) {
        errors.push(`Line ${i + 1}: value must be greater than 0`);
        return;
      }
      rows.push({ productCategory: category, dealValue: Math.round(value) });
    });
  return { rows, errors };
}

const EXAMPLE = "Compute 180000\nStorage 96,500\nNetworking 65k\nServices 42000";

export function PasteLinesDialog({
  onImport,
  importing,
  size,
  variant = "outline",
}: {
  onImport: (rows: ParsedLine[]) => Promise<void>;
  importing: boolean;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "default";
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const parsed = useMemo(() => parseLines(text), [text]);

  const submit = async () => {
    if (parsed.rows.length === 0 || importing) return;
    try {
      await onImport(parsed.rows);
      setOpen(false);
      setText("");
    } catch {
      // Parent toasts; keep the text so it can be fixed and retried.
    }
  };

  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        <ClipboardPaste className="h-4 w-4" />
        Paste lines
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Paste line items</DialogTitle>
            <DialogDescription>
              One line per item: a category and a value. Each line gets its own AI recommendation
              as it lands.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="label-caps" htmlFor="paste-lines">
                Lines
              </label>
              <textarea
                id="paste-lines"
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                placeholder={EXAMPLE}
                spellCheck={false}
                className="mt-2 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm leading-relaxed placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <button
                type="button"
                onClick={() => setText(EXAMPLE)}
                className="pressable mt-2 text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Use the example
              </button>
            </div>
            <div>
              <p className="label-caps">Preview</p>
              {parsed.rows.length === 0 && parsed.errors.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Categories: {PRODUCT_CATEGORIES.join(", ")}. Values accept commas and k / m.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-border rounded-md border border-border">
                  {parsed.rows.map((r, i) => (
                    <li key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="font-medium">{r.productCategory}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {r.dealValue.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {parsed.errors.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-danger">
                  {parsed.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={parsed.rows.length === 0 || importing}
              onClick={() => void submit()}
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Add {parsed.rows.length || ""} {parsed.rows.length === 1 ? "line" : "lines"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
