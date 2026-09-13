"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryMultiSelect } from "@/components/app/category-multiselect";
import { Segmented } from "@/components/ui/segmented";
import { useCreateDealMutation } from "@/lib/queries";
import { TERM_LENGTH_LABEL, TERM_LENGTHS } from "@/lib/deal-data";
import { REGIONS } from "@/lib/fx-rates";
import { ApiError } from "@/lib/api";
import type { ProductCategory, Region, TermLength } from "@/lib/api-types";

function errorMessage(error: unknown): string {
  return error instanceof ApiError || error instanceof Error ? error.message : "Something went wrong";
}

const DEFAULT_CATEGORIES: ProductCategory[] = ["Compute"];

/** Starts a brand-new quote from a blank deal, rather than only ever editing
 * one of the pre-seeded sample deals — the actual "quote building" entry
 * point the rest of the deal review flow assumes exists upstream of it. */
export function NewDealDialog() {
  const router = useRouter();
  const createDealMutation = useCreateDealMutation();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [termLength, setTermLength] = useState<TermLength>("12mo");
  const [region, setRegion] = useState<Region>("north_america");
  const [categories, setCategories] = useState<ProductCategory[]>(DEFAULT_CATEGORIES);

  // Opened by the N shortcut on Home, or by "/?new=1" from the palette or the
  // shortcut on another page. The query param is cleared once consumed so a
  // refresh doesn't reopen it.
  useEffect(() => {
    const onOpenRequest = () => setOpen(true);
    document.addEventListener("new-deal:open", onOpenRequest);
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      setOpen(true);
      router.replace("/");
    }
    return () => document.removeEventListener("new-deal:open", onOpenRequest);
  }, [router]);

  const resetForm = () => {
    setName("");
    setCustomerName("");
    setTermLength("12mo");
    setRegion("north_america");
    setCategories(DEFAULT_CATEGORIES);
  };

  const canSubmit = name.trim() !== "" && customerName.trim() !== "" && categories.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      const detail = await createDealMutation.mutateAsync({
        name: name.trim(),
        customerName: customerName.trim(),
        termLength,
        region,
        productCategories: categories,
      });
      setOpen(false);
      resetForm();
      toast.success(`${detail.deal.name} created`);
      router.push(`/deals?deal=${detail.deal.id}`);
    } catch (error) {
      toast.error("Couldn't create the deal", { description: errorMessage(error) });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button data-shortcut="new-deal">
          <Plus className="h-4 w-4" />
          New Deal
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a new deal</DialogTitle>
          <DialogDescription>
            Set up the basics, then add line items and get AI recommendations next.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="label-caps" htmlFor="new-deal-name">
              Deal name
            </label>
            <Input
              id="new-deal-name"
              className="mt-2"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corp — FY27 Expansion"
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) void handleSubmit();
              }}
            />
          </div>

          <div>
            <label className="label-caps" htmlFor="new-deal-customer">
              Customer name
            </label>
            <Input
              id="new-deal-customer"
              className="mt-2"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Acme Corp"
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) void handleSubmit();
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="label-caps" id="new-deal-term-label">
                Term length
              </span>
              <div className="mt-2">
                <Segmented
                  aria-labelledby="new-deal-term-label"
                  value={termLength}
                  onChange={setTermLength}
                  options={TERM_LENGTHS.map((term) => ({
                    value: term,
                    label: TERM_LENGTH_LABEL[term].replace(" months", " mo"),
                  }))}
                  className="w-full"
                />
              </div>
            </div>

            <div>
              <label className="label-caps" htmlFor="new-deal-region">
                Region
              </label>
              <div className="mt-2">
                <Select value={region} onValueChange={(v) => setRegion(v as Region)}>
                  <SelectTrigger id="new-deal-region">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label} ({r.currencyCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div>
            <span className="label-caps">Product categories</span>
            <div className="mt-2">
              <CategoryMultiSelect value={categories} onChange={setCategories} />
            </div>
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!canSubmit || createDealMutation.isPending} onClick={() => void handleSubmit()}>
            {createDealMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Create deal"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
