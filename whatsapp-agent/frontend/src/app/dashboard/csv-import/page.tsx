"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/apiClient";

const TARGET_FIELDS = ["name", "phone", "company", "source", "notes", "tags"];

type Step = "upload" | "map" | "result";

export default function CsvImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<string[][]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ success_count: number; error_count: number; total_rows: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onUpload(f: File) {
    setFile(f);
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", f);
      const res = await api.post<{ headers: string[]; sample_rows: string[][]; total_rows: number; suggested_mapping: Record<string, string | null> }>(
        "/csv-imports/preview",
        form
      );
      setHeaders(res.headers);
      setSampleRows(res.sample_rows);
      setTotalRows(res.total_rows);
      const cleaned: Record<string, string> = {};
      Object.entries(res.suggested_mapping).forEach(([k, v]) => {
        if (v) cleaned[k] = v;
      });
      setMapping(cleaned);
      setStep("map");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't read that file");
    } finally {
      setLoading(false);
    }
  }

  async function confirmImport() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("payload", JSON.stringify({ mapping, default_region: "IN", dedupe_strategy: "skip" }));
      const res = await api.post<{ success_count: number; error_count: number; total_rows: number }>("/csv-imports", form);
      setResult(res);
      setStep("result");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep("upload");
    setFile(null);
    setHeaders([]);
    setMapping({});
    setResult(null);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold text-ink-800">Import leads from CSV</h1>
      <p className="mt-1 text-sm text-ink-400">Upload a spreadsheet from an event or a purchased list — Claude suggests the column mapping for you.</p>

      <div className="mt-6 flex items-center gap-2 text-xs font-medium text-ink-400">
        {["Upload", "Map columns", "Review"].map((label, i) => (
          <span key={label} className={`rounded-full px-3 py-1 ${["upload", "map", "result"][i] === step ? "bg-brand-500 text-white" : "bg-ink-100"}`}>
            {i + 1}. {label}
          </span>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {step === "upload" && (
        <div className="card mt-6 border-2 border-dashed border-ink-200 p-12 text-center">
          <input
            type="file"
            accept=".csv"
            id="csv-file"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
          />
          <label htmlFor="csv-file" className="btn-primary cursor-pointer">
            {loading ? "Reading file..." : "Choose CSV file"}
          </label>
          <p className="mt-3 text-xs text-ink-400">Phone numbers are normalized automatically (default region: India)</p>
        </div>
      )}

      {step === "map" && (
        <div className="card mt-6 p-6">
          <p className="mb-4 text-sm text-ink-500">{totalRows} rows found. Map your columns to lead fields:</p>
          <div className="grid grid-cols-2 gap-4">
            {TARGET_FIELDS.map((field) => (
              <div key={field}>
                <label className="label capitalize">
                  {field} {field === "phone" && <span className="text-red-500">*</span>}
                </label>
                <select
                  className="input"
                  value={mapping[field] || ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}
                >
                  <option value="">— none —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {sampleRows.length > 0 && (
            <div className="mt-5 overflow-x-auto rounded-lg border border-black/5">
              <table className="w-full text-left text-xs">
                <thead className="bg-ink-50">
                  <tr>
                    {headers.map((h) => (
                      <th key={h} className="px-3 py-2 font-medium text-ink-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sampleRows.map((row, i) => (
                    <tr key={i} className="border-t border-black/5">
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-2 text-ink-600">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <button className="btn-secondary" onClick={reset}>
              Back
            </button>
            <button className="btn-primary" disabled={!mapping.phone || loading} onClick={confirmImport}>
              {loading ? "Importing..." : `Import ${totalRows} rows`}
            </button>
          </div>
        </div>
      )}

      {step === "result" && result && (
        <div className="card mt-6 p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-2xl">✓</div>
          <h2 className="text-lg font-semibold text-ink-800">Import complete</h2>
          <p className="mt-2 text-sm text-ink-500">
            {result.success_count} imported · {result.error_count} skipped or failed · {result.total_rows} total rows
          </p>
          <button className="btn-primary mt-6" onClick={reset}>
            Import another file
          </button>
        </div>
      )}
    </div>
  );
}
