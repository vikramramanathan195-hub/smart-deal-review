"use client";

import { useState } from "react";
import { Loader2, Printer, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QuoteSheet } from "@/components/app/quote-sheet";
import type { DealDetail, LineItemDetail, Region, SendQuoteBody } from "@/lib/api-types";

function suggestedRecipient(customerName: string): string {
  // .example is reserved by the IETF, so a suggested address can never
  // point at a real mailbox.
  const slug = customerName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `procurement@${slug || "customer"}.example`;
}

/** Preview the quote exactly as it prints, then send it. Sending is
 * simulated (nothing leaves this app) but the deal is marked sent, which
 * the stepper, Home card, and summary all reflect. */
export function SendQuoteDialog({
  deal,
  lineItems,
  blended,
  region,
  summary,
  canSend,
  blockedReason,
  sending,
  onSend,
}: {
  deal: DealDetail;
  lineItems: LineItemDetail[];
  blended: number;
  region: Region;
  summary: string;
  canSend: boolean;
  blockedReason: string | null;
  sending: boolean;
  onSend: (body: SendQuoteBody) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const openWithDefaults = () => {
    setRecipient(suggestedRecipient(deal.customer.name));
    setSubject(`Quote: ${deal.deal.name}`);
    setMessage(
      `Hello ${deal.customer.name} team,\n\nPlease find our quote for ${deal.deal.name} attached.\n\n${summary}\n\nHappy to walk through any line in detail.`,
    );
    setOpen(true);
  };

  const valid = recipient.trim().includes("@") && subject.trim() !== "";

  const submit = async () => {
    if (!valid || sending) return;
    try {
      await onSend({ recipient: recipient.trim(), subject: subject.trim(), message: message.trim() });
      setOpen(false);
    } catch {
      // Parent toasts; keep the dialog open so nothing typed is lost.
    }
  };

  return (
    <>
      <Button
        onClick={openWithDefaults}
        disabled={!canSend}
        title={canSend ? undefined : (blockedReason ?? undefined)}
      >
        <Send className="h-4 w-4" />
        Preview &amp; send quote
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl print:hidden">
          <DialogHeader>
            <DialogTitle>Send quote</DialogTitle>
            <DialogDescription>
              This is exactly what the customer receives. Sending is simulated in this demo, but the
              deal is marked as sent.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div
              role="region"
              aria-label="Quote preview"
              tabIndex={0}
              className="max-h-[60vh] overflow-y-auto rounded-lg bg-secondary/60 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <QuoteSheet
                deal={deal}
                lineItems={lineItems}
                blended={blended}
                region={region}
                mode="screen"
              />
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="label-caps" htmlFor="quote-recipient">
                  To
                </label>
                <Input
                  id="quote-recipient"
                  className="mt-2"
                  type="email"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="customer@company.com"
                />
              </div>
              <div>
                <label className="label-caps" htmlFor="quote-subject">
                  Subject
                </label>
                <Input
                  id="quote-subject"
                  className="mt-2"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div className="flex min-h-0 flex-1 flex-col">
                <label className="label-caps" htmlFor="quote-message">
                  Message
                </label>
                <textarea
                  id="quote-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={10}
                  className="mt-2 w-full flex-1 resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-relaxed placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Pre-filled from the deal summary. Edit anything before sending.
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" />
                  Print / Save PDF
                </Button>
                <Button type="button" disabled={!valid || sending} onClick={() => void submit()}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send quote
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
