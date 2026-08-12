"use client";

import * as React from "react";
import {
  Database,
  Upload,
  Download,
  FileJson,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
  RefreshCw,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  useAccounts,
  useCustomers,
  useVendors,
  useCategories,
  useSales,
  useExpenses,
  useTransfers,
  useInvoices,
  useAR,
  useAP,
  useBudget,
  useGoals,
  useRecurring,
  useReconciliations,
  qk,
} from "@/hooks/use-finance";
import { exportToCSV } from "@/lib/export";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

type ImportMode = "json" | "csv";
type WriteMode = "merge" | "replace";

interface JsonPreview {
  metadata?: {
    version?: string;
    exportDate?: string;
    counts?: Record<string, number>;
  };
  data?: Record<string, unknown>;
}

const CSV_SAMPLE = `type,date,amount,description,category,account,vendor/customer,notes
sale,2026-08-01,45000,Consulting retainer,Consulting,HDFC Business Checking,Acme Corp,Monthly retainer
expense,2026-08-02,18000,Office rent,Rent & Utilities,HDFC Business Checking,WeWork,August rent
expense,2026-08-05,2500,Internet bill,Internet & Phone,HDFC Business Checking,Airtel Business,Fiber plan
sale,2026-08-07,28000,Logo design,Services,Cash Wallet,Globex Ltd,One-off project`;

export function DataManagerView() {
  const qc = useQueryClient();

  // Counts for the export card.
  const accounts = useAccounts();
  const customers = useCustomers();
  const vendors = useVendors();
  const categories = useCategories();
  const sales = useSales();
  const expenses = useExpenses();
  const transfers = useTransfers();
  const invoices = useInvoices();
  const ar = useAR();
  const ap = useAP();
  const budget = useBudget();
  const goals = useGoals();
  const recurring = useRecurring();
  const reconciliations = useReconciliations();

  const countRows = [
    { label: "Accounts", value: accounts.data?.length },
    { label: "Customers", value: customers.data?.length },
    { label: "Vendors", value: vendors.data?.length },
    { label: "Categories", value: categories.data?.length },
    { label: "Sales", value: sales.data?.length },
    { label: "Expenses", value: expenses.data?.length },
    { label: "Transfers", value: transfers.data?.length },
    { label: "Invoices", value: invoices.data?.length },
    { label: "Receivables", value: ar.data?.length },
    { label: "Payables", value: ap.data?.length },
    { label: "Budgets", value: budget.data?.length },
    { label: "Savings Goals", value: goals.data?.length },
    { label: "Recurring", value: recurring.data?.length },
    { label: "Reconciliations", value: reconciliations.data?.length },
  ];

  const [exporting, setExporting] = React.useState(false);

  const handleExportJson = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/export");
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const text = await res.text();
      const date = new Date().toISOString().slice(0, 10);
      const blob = new Blob([text], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `finflow-backup-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 0);
      toast.success("Backup downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleExportCsv = (
    kind: "sales" | "expenses" | "transfers" | "invoices",
  ) => {
    const date = new Date().toISOString().slice(0, 10);
    if (kind === "sales" && sales.data && sales.data.length > 0) {
      exportToCSV(`finflow-sales-${date}.csv`, sales.data, [
        { key: "date", label: "Date" },
        { key: "customerId", label: "Customer ID" },
        { key: "accountId", label: "Account ID" },
        { key: "amount", label: "Amount" },
        { key: "tax", label: "Tax" },
        { key: "total", label: "Total" },
        { key: "status", label: "Status" },
        { key: "notes", label: "Notes" },
      ]);
      toast.success(`Exported ${sales.data.length} sales`);
    } else if (kind === "expenses" && expenses.data && expenses.data.length > 0) {
      exportToCSV(`finflow-expenses-${date}.csv`, expenses.data, [
        { key: "date", label: "Date" },
        { key: "vendorId", label: "Vendor ID" },
        { key: "categoryId", label: "Category ID" },
        { key: "accountId", label: "Account ID" },
        { key: "amount", label: "Amount" },
        { key: "total", label: "Total" },
        { key: "budgetType", label: "Budget Type" },
        { key: "status", label: "Status" },
        { key: "notes", label: "Notes" },
      ]);
      toast.success(`Exported ${expenses.data.length} expenses`);
    } else if (kind === "transfers" && transfers.data && transfers.data.length > 0) {
      exportToCSV(`finflow-transfers-${date}.csv`, transfers.data, [
        { key: "date", label: "Date" },
        { key: "fromAccountId", label: "From Account" },
        { key: "toAccountId", label: "To Account" },
        { key: "amount", label: "Amount" },
        { key: "fee", label: "Fee" },
        { key: "notes", label: "Notes" },
      ]);
      toast.success(`Exported ${transfers.data.length} transfers`);
    } else if (kind === "invoices" && invoices.data && invoices.data.length > 0) {
      exportToCSV(`finflow-invoices-${date}.csv`, invoices.data, [
        { key: "number", label: "Number" },
        { key: "customerId", label: "Customer ID" },
        { key: "issueDate", label: "Issue Date" },
        { key: "dueDate", label: "Due Date" },
        { key: "subtotal", label: "Subtotal" },
        { key: "tax", label: "Tax" },
        { key: "total", label: "Total" },
        { key: "paidAmount", label: "Paid" },
        { key: "status", label: "Status" },
      ]);
      toast.success(`Exported ${invoices.data.length} invoices`);
    } else {
      toast.error("No records to export for this type");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Data Manager</h2>
        <p className="text-sm text-muted-foreground">
          Export a full JSON backup or import data from a previous backup / CSV file.
        </p>
      </div>

      <ExportCard
        exporting={exporting}
        onExportJson={handleExportJson}
        onExportCsv={handleExportCsv}
        counts={countRows}
      />

      <ImportCard
        onComplete={() => {
          // Invalidate every query so all views refetch fresh data.
          qc.invalidateQueries();
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export card
// ---------------------------------------------------------------------------

interface ExportCardProps {
  exporting: boolean;
  onExportJson: () => void;
  onExportCsv: (kind: "sales" | "expenses" | "transfers" | "invoices") => void;
  counts: { label: string; value?: number }[];
}

function ExportCard({ exporting, onExportJson, onExportCsv, counts }: ExportCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Export Data</CardTitle>
              <CardDescription>
                Download a complete backup of all your financial data as a JSON file.
              </CardDescription>
            </div>
          </div>
          <Button onClick={onExportJson} disabled={exporting} className="gap-1.5">
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export JSON Backup
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            What&apos;s included
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {counts.map((c) => (
              <div
                key={c.label}
                className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-center"
              >
                <p className="text-base font-semibold tabular">{c.value ?? "—"}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {c.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Export individual transaction types as CSV
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onExportCsv("sales")}>
              <FileSpreadsheet className="h-3.5 w-3.5" /> Sales CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onExportCsv("expenses")}>
              <FileSpreadsheet className="h-3.5 w-3.5" /> Expenses CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onExportCsv("transfers")}>
              <FileSpreadsheet className="h-3.5 w-3.5" /> Transfers CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onExportCsv("invoices")}>
              <FileSpreadsheet className="h-3.5 w-3.5" /> Invoices CSV
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Import card
// ---------------------------------------------------------------------------

interface ImportCardProps {
  onComplete: () => void;
}

function ImportCard({ onComplete }: ImportCardProps) {
  const [importMode, setImportMode] = React.useState<ImportMode>("json");
  const [writeMode, setWriteMode] = React.useState<WriteMode>("merge");

  const [file, setFile] = React.useState<File | null>(null);
  const [jsonPreview, setJsonPreview] = React.useState<JsonPreview | null>(null);
  const [csvPreview, setCsvPreview] = React.useState<{ rows: string[][]; rowCount: number } | null>(null);
  const [parseError, setParseError] = React.useState<string | null>(null);

  const [importing, setImporting] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [result, setResult] = React.useState<{
    imported?: Record<string, number>;
    importedCount?: number;
    skipped?: number;
    errors: string[];
  } | null>(null);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

  const reset = () => {
    setFile(null);
    setJsonPreview(null);
    setCsvPreview(null);
    setParseError(null);
    setResult(null);
    setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (f: File) => {
    reset();
    setFile(f);
    try {
      if (importMode === "json") {
        const text = await f.text();
        const parsed = JSON.parse(text) as JsonPreview;
        if (!parsed.data || typeof parsed.data !== "object") {
          throw new Error("Invalid backup file: missing top-level `data` object.");
        }
        setJsonPreview(parsed);
      } else {
        const text = await f.text();
        const rows = parseCsvPreview(text);
        if (rows.length === 0) throw new Error("CSV file is empty.");
        setCsvPreview({ rows: rows.slice(0, 6), rowCount: rows.length - 1 });
      }
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Failed to parse file");
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);
    setProgress(10);
    try {
      const isReplace = writeMode === "replace";
      if (isReplace && !confirm(
        "Replace mode will DELETE all existing data before importing. This cannot be undone. Continue?",
      )) {
        setImporting(false);
        setProgress(0);
        return;
      }

      setProgress(30);
      const url =
        importMode === "csv"
          ? `/api/import?format=csv&mode=${writeMode}`
          : `/api/import?mode=${writeMode}`;

      const body =
        importMode === "csv"
          ? await file.text()
          : await file.text(); // already JSON text

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": importMode === "csv" ? "text/csv" : "application/json",
        },
        body,
      });

      setProgress(80);

      const data = (await res.json().catch(() => ({}))) as {
        imported?: Record<string, number>;
        importedCount?: number;
        skipped?: number;
        errors?: string[];
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error ?? `Import failed (${res.status})`);
      }

      setProgress(100);
      const errors = data.errors ?? [];
      setResult({
        imported: data.imported,
        importedCount: data.importedCount,
        skipped: data.skipped,
        errors,
      });

      if (errors.length === 0) {
        toast.success("Import completed successfully");
      } else {
        toast.warning(`Import completed with ${errors.length} warning(s)`);
      }
      onComplete();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
      setProgress(0);
    } finally {
      setImporting(false);
    }
  };

  // Calculate JSON import summary for preview
  const jsonCounts = jsonPreview?.metadata?.counts ?? countFromData(jsonPreview?.data);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Import Data</CardTitle>
            <CardDescription>
              Restore from a previous JSON backup, or bulk-import transactions from CSV.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Mode tabs */}
        <div className="flex flex-wrap gap-2">
          <ModeButton
            active={importMode === "json"}
            onClick={() => {
              setImportMode("json");
              reset();
            }}
            icon={<FileJson className="h-4 w-4" />}
            label="Restore from Backup (JSON)"
          />
          <ModeButton
            active={importMode === "csv"}
            onClick={() => {
              setImportMode("csv");
              reset();
            }}
            icon={<FileSpreadsheet className="h-4 w-4" />}
            label="Import Transactions (CSV)"
          />
        </div>

        {/* Write mode selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Mode:
          </span>
          <ModeButton
            active={writeMode === "merge"}
            onClick={() => setWriteMode("merge")}
            label="Merge"
            small
          />
          <ModeButton
            active={writeMode === "replace"}
            onClick={() => setWriteMode("replace")}
            label="Replace all"
            small
            danger
          />
        </div>

        {writeMode === "replace" && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Replace mode</AlertTitle>
            <AlertDescription>
              This will permanently delete ALL existing data before importing. This action cannot be undone.
            </AlertDescription>
          </Alert>
        )}

        {/* Drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/40 hover:bg-accent/30",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept={importMode === "json" ? ".json,application/json" : ".csv,text/csv"}
            className="hidden"
            onChange={onInputChange}
          />
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Upload className="h-5 w-5 text-muted-foreground" />
          </div>
          {file ? (
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB · click to choose a different file
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              <p className="text-sm font-medium">
                {importMode === "json"
                  ? "Drop your JSON backup file here"
                  : "Drop your CSV file here"}
              </p>
              <p className="text-xs text-muted-foreground">
                or click to browse — {importMode === "json" ? ".json" : ".csv"} files
              </p>
            </div>
          )}
        </div>

        {/* Parse error */}
        {parseError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Could not read file</AlertTitle>
            <AlertDescription>{parseError}</AlertDescription>
          </Alert>
        )}

        {/* JSON preview */}
        {importMode === "json" && jsonPreview && (
          <div className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <p className="text-sm font-semibold">Backup file loaded</p>
            </div>
            {jsonPreview.metadata?.exportDate && (
              <p className="text-xs text-muted-foreground">
                Originally exported: {new Date(jsonPreview.metadata.exportDate).toLocaleString("en-IN")}
                {jsonPreview.metadata.version && ` · v${jsonPreview.metadata.version}`}
              </p>
            )}
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Records to import
              </p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">
                {Object.entries(jsonCounts).map(([k, v]) => (
                  <div key={k} className="rounded-md bg-muted/40 px-2 py-1.5 text-center">
                    <p className="text-sm font-semibold tabular">{v}</p>
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{k}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CSV preview */}
        {importMode === "csv" && csvPreview && (
          <div className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <p className="text-sm font-semibold">
                {csvPreview.rowCount} data row{csvPreview.rowCount === 1 ? "" : "s"} detected
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {csvPreview.rows[0]?.map((h, i) => (
                      <th key={i} className="px-2 py-1.5 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvPreview.rows.slice(1).map((row, ri) => (
                    <tr key={ri} className="border-b border-border/60">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-2 py-1.5 text-muted-foreground">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {csvPreview.rowCount > 5 && (
              <p className="text-[10px] text-muted-foreground">
                Showing first 5 rows of {csvPreview.rowCount}.
              </p>
            )}
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Expected CSV format
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-md bg-muted/40 p-3 text-[10px] leading-relaxed">
                {CSV_SAMPLE}
              </pre>
            </details>
          </div>
        )}

        {/* Progress bar */}
        {importing && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Importing…
              </span>
              <span className="tabular">{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {/* Result */}
        {result && !importing && (
          <div className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center gap-2">
              {result.errors.length === 0 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              )}
              <p className="text-sm font-semibold">Import complete</p>
            </div>
            {importMode === "json" && result.imported ? (
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">
                {Object.entries(result.imported).map(([k, v]) => (
                  <div key={k} className="rounded-md bg-muted/40 px-2 py-1.5 text-center">
                    <p className="text-sm font-semibold tabular">{v}</p>
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{k}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm">
                Imported <span className="font-semibold tabular">{result.importedCount ?? 0}</span> transaction(s)
                {result.skipped ? `, skipped ${result.skipped}` : ""}.
              </p>
            )}
            {result.errors.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-amber-600 dark:text-amber-400">
                  {result.errors.length} warning(s) / error(s)
                </summary>
                <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto rounded-md bg-muted/40 p-2 font-mono text-[10px]">
                  {result.errors.slice(0, 50).map((e, i) => (
                    <li key={i} className="text-muted-foreground">• {e}</li>
                  ))}
                  {result.errors.length > 50 && (
                    <li className="text-muted-foreground">… and {result.errors.length - 50} more</li>
                  )}
                </ul>
              </details>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleImport}
            disabled={!file || !!parseError || importing || (!jsonPreview && !csvPreview)}
            className="gap-1.5"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {importMode === "json" ? "Restore Backup" : "Import Transactions"}
          </Button>
          {file && (
            <Button variant="outline" onClick={reset} disabled={importing} className="gap-1.5">
              <X className="h-4 w-4" /> Clear
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto gap-1.5 text-muted-foreground"
            onClick={() => window.location.reload()}
            disabled={importing}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh data
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Small UI helpers
// ---------------------------------------------------------------------------

function ModeButton({
  active,
  onClick,
  icon,
  label,
  small,
  danger,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  label: string;
  small?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border font-medium transition-colors",
        small ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
        active
          ? danger
            ? "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400"
            : "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * Lightweight CSV preview parser — splits lines and columns, handling quoted
 * fields with embedded commas/newlines (best-effort). Used only to show the
 * first few rows to the user; the server does the authoritative parsing.
 */
function parseCsvPreview(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.startsWith("\uFEFF") ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        cur.push(field);
        field = "";
      } else if (ch === "\n") {
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = "";
      } else if (ch === "\r") {
        // ignore
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  return rows.filter((r) => r.length > 0 && !(r.length === 1 && r[0] === ""));
}

/** Build a counts map from the raw data object (fallback when metadata is missing). */
function countFromData(data?: Record<string, unknown>): Record<string, number> {
  if (!data) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(data)) {
    if (Array.isArray(v)) out[k] = v.length;
  }
  return out;
}
