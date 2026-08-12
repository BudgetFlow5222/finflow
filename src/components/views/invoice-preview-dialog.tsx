"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Printer,
  Download,
  Banknote,
  Pencil,
  X,
  FileText,
  Building2,
  Calendar,
  Clock,
} from "lucide-react";
import type { Invoice, Customer } from "@/types";
import { StatusBadge, invoiceStatusVariant } from "@/components/status-badge";
import { formatCurrency, formatDate, daysUntil, initials } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoice: (Invoice & { customer?: Customer }) | null;
  onRecordPayment?: (inv: Invoice) => void;
  onEdit?: (inv: Invoice) => void;
}

export function InvoicePreviewDialog({
  open,
  onOpenChange,
  invoice,
  onRecordPayment,
  onEdit,
}: Props) {
  const previewRef = React.useRef<HTMLDivElement>(null);

  if (!invoice) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md" />
      </Dialog>
    );
  }

  const inv = invoice;
  const customer = inv.customer;
  const items = inv.items ?? [];
  const balance = inv.total - inv.paidAmount;
  const due = daysUntil(inv.dueDate);
  const isOverdue = due < 0 && inv.status !== "PAID";

  const handlePrint = () => {
    const printContents = previewRef.current?.innerHTML ?? "";
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) {
      toast.error("Popup blocked — please allow popups to print");
      return;
    }
    win.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${inv.number} — FinFlow</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1a1a1a; padding: 48px; background: #fff; }
          .doc { max-width: 720px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 2px solid #10b981; }
          .brand { display: flex; align-items: center; gap: 12px; }
          .logo { width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #10b981, #14b8a6); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 20px; }
          .brand-name { font-size: 20px; font-weight: 700; color: #0f172a; }
          .brand-sub { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
          .inv-num { text-align: right; }
          .inv-num .label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
          .inv-num .value { font-size: 20px; font-weight: 700; color: #0f172a; }
          .badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
          .label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
          .value { font-size: 14px; color: #1a1a1a; font-weight: 500; }
          .value strong { font-weight: 700; }
          table { width: 100%; border-collapse: collapse; margin: 24px 0; }
          th { text-align: left; padding: 12px 16px; background: #f8fafc; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
          th:last-child, td:last-child { text-align: right; }
          th.num, td.num { text-align: right; }
          td { padding: 14px 16px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
          td.desc { font-weight: 500; }
          .totals { margin-left: auto; width: 280px; margin-top: 16px; }
          .totals .row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; }
          .totals .row.total { border-top: 2px solid #0f172a; padding-top: 14px; margin-top: 8px; font-size: 18px; font-weight: 700; }
          .totals .row .muted { color: #64748b; }
          .footer { margin-top: 56px; padding-top: 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
          .notes { margin-top: 24px; padding: 16px; background: #f8fafc; border-radius: 8px; font-size: 12px; color: #475569; }
          .paid-stamp { position: absolute; top: 100px; right: 80px; transform: rotate(-12deg); border: 3px solid #10b981; color: #10b981; padding: 8px 24px; font-size: 24px; font-weight: 800; letter-spacing: 2px; border-radius: 8px; opacity: 0.8; }
        </style>
      </head>
      <body>
        <div class="doc">
          <div class="header">
            <div class="brand">
              <div class="logo">F</div>
              <div>
                <div class="brand-name">FinFlow</div>
                <div class="brand-sub">Invoice</div>
              </div>
            </div>
            <div class="inv-num">
              <div class="label">Invoice Number</div>
              <div class="value">${inv.number}</div>
              <div style="margin-top:8px;">
                <span class="badge" style="background:${inv.status === "PAID" ? "#dcfce7" : inv.status === "OVERDUE" ? "#fee2e2" : "#dbeafe"}; color:${inv.status === "PAID" ? "#166534" : inv.status === "OVERDUE" ? "#991b1b" : "#1e40af"};">
                  ${inv.status.replace(/_/g, " ")}
                </span>
              </div>
            </div>
          </div>

          <div class="grid">
            <div>
              <div class="label">Billed To</div>
              <div class="value"><strong>${customer?.name ?? "—"}</strong></div>
              ${customer?.company ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">${customer.company}</div>` : ""}
              ${customer?.email ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">${customer.email}</div>` : ""}
              ${customer?.phone ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">${customer.phone}</div>` : ""}
            </div>
            <div>
              <div class="label">Issue Date</div>
              <div class="value">${formatDate(inv.issueDate, "long")}</div>
              <div class="label" style="margin-top:12px;">Due Date</div>
              <div class="value">${formatDate(inv.dueDate, "long")}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th class="num">Qty</th>
                <th class="num">Rate</th>
                <th class="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((it) => `
                <tr>
                  <td class="desc">${it.description}</td>
                  <td class="num">${it.quantity}</td>
                  <td class="num">${formatCurrency(it.rate)}</td>
                  <td class="num">${formatCurrency(it.amount)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div class="totals">
            <div class="row"><span class="muted">Subtotal</span><span>${formatCurrency(inv.subtotal)}</span></div>
            ${inv.discount > 0 ? `<div class="row"><span class="muted">Discount</span><span>−${formatCurrency(inv.discount)}</span></div>` : ""}
            <div class="row"><span class="muted">Tax (${inv.taxRate}%)</span><span>${formatCurrency(inv.tax)}</span></div>
            <div class="row total"><span>Total</span><span>${formatCurrency(inv.total)}</span></div>
            ${inv.paidAmount > 0 ? `<div class="row"><span class="muted">Paid</span><span style="color:#10b981;">−${formatCurrency(inv.paidAmount)}</span></div>` : ""}
            ${balance > 0 ? `<div class="row" style="font-weight:600;color:#dc2626;"><span>Balance Due</span><span>${formatCurrency(balance)}</span></div>` : ""}
          </div>

          ${inv.notes ? `<div class="notes"><strong>Notes:</strong> ${inv.notes}</div>` : ""}

          <div class="footer">
            Thank you for your business. Generated by FinFlow on ${new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}.
          </div>
        </div>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 300);
  };

  const handleDownloadHTML = () => {
    const html = previewRef.current?.outerHTML ?? "";
    const blob = new Blob([
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${inv.number}</title><style>body{font-family:sans-serif;padding:40px;}</style></head><body>${html}</body></html>`,
    ], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${inv.number}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Invoice downloaded");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto scrollbar-thin p-0">
        {/* Action bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-5 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            <span className="text-sm font-semibold">{inv.number}</span>
            <StatusBadge variant={invoiceStatusVariant(inv.status)} dot={false}>
              {inv.status.replace(/_/g, " ")}
            </StatusBadge>
          </div>
          <div className="flex items-center gap-1">
            {onRecordPayment && inv.status !== "PAID" && inv.status !== "CANCELLED" && (
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => { onOpenChange(false); onRecordPayment(inv); }}>
                <Banknote className="h-3.5 w-3.5" /> Payment
              </Button>
            )}
            {onEdit && (
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => { onOpenChange(false); onEdit(inv); }}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handleDownloadHTML}>
              <Download className="h-3.5 w-3.5" /> HTML
            </Button>
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
          </div>
        </div>

        {/* Preview document */}
        <div ref={previewRef} className="invoice-doc bg-white text-slate-900 px-8 py-8">
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-emerald-500 pb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-lg font-bold text-white">
                F
              </div>
              <div>
                <div className="text-lg font-bold text-slate-900">FinFlow</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Invoice</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Invoice Number</div>
              <div className="text-lg font-bold text-slate-900">{inv.number}</div>
              <div className="mt-2">
                <span
                  className="inline-block rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide"
                  style={{
                    backgroundColor: inv.status === "PAID" ? "#dcfce7" : inv.status === "OVERDUE" ? "#fee2e2" : inv.status === "PARTIALLY_PAID" ? "#fef3c7" : "#dbeafe",
                    color: inv.status === "PAID" ? "#166534" : inv.status === "OVERDUE" ? "#991b1b" : inv.status === "PARTIALLY_PAID" ? "#92400e" : "#1e40af",
                  }}
                >
                  {inv.status.replace(/_/g, " ")}
                </span>
              </div>
            </div>
          </div>

          {/* Bill To + Dates */}
          <div className="grid grid-cols-2 gap-8 py-6">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Billed To</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{customer?.name ?? "—"}</div>
              {customer?.company && <div className="text-xs text-slate-500">{customer.company}</div>}
              {customer?.email && <div className="text-xs text-slate-500">{customer.email}</div>}
              {customer?.phone && <div className="text-xs text-slate-500">{customer.phone}</div>}
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Issue Date</div>
                <div className="text-sm font-medium text-slate-900">{formatDate(inv.issueDate, "long")}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Due Date</div>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  {formatDate(inv.dueDate, "long")}
                  {isOverdue && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                      {Math.abs(due)}d overdue
                    </span>
                  )}
                  {due >= 0 && inv.status !== "PAID" && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      in {due}d
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Items table */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200 bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 font-semibold">Description</th>
                <th className="px-4 py-3 text-right font-semibold">Qty</th>
                <th className="px-4 py-3 text-right font-semibold">Rate</th>
                <th className="px-4 py-3 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{it.description}</td>
                  <td className="px-4 py-3 text-right tabular text-slate-600">{it.quantity}</td>
                  <td className="px-4 py-3 text-right tabular text-slate-600">{formatCurrency(it.rate)}</td>
                  <td className="px-4 py-3 text-right tabular font-medium text-slate-900">{formatCurrency(it.amount)}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-xs text-slate-400">
                    No line items
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-6 flex justify-end">
            <div className="w-72 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span className="tabular">{formatCurrency(inv.subtotal)}</span>
              </div>
              {inv.discount > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Discount</span>
                  <span className="tabular">−{formatCurrency(inv.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500">
                <span>Tax ({inv.taxRate}%)</span>
                <span className="tabular">{formatCurrency(inv.tax)}</span>
              </div>
              <Separator className="my-2 bg-slate-900" />
              <div className="flex justify-between text-base font-bold text-slate-900">
                <span>Total</span>
                <span className="tabular">{formatCurrency(inv.total)}</span>
              </div>
              {inv.paidAmount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Paid</span>
                  <span className="tabular">−{formatCurrency(inv.paidAmount)}</span>
                </div>
              )}
              {balance > 0 && (
                <div className="flex justify-between font-semibold text-red-600">
                  <span>Balance Due</span>
                  <span className="tabular">{formatCurrency(balance)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {inv.notes && (
            <div className="mt-6 rounded-lg bg-slate-50 p-4 text-xs text-slate-600">
              <strong className="text-slate-900">Notes:</strong> {inv.notes}
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 border-t border-slate-200 pt-4 text-center text-[10px] text-slate-400">
            Thank you for your business. Generated by FinFlow on{" "}
            {new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
