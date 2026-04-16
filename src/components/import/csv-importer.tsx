'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, CheckCircle, XCircle, Loader2, ArrowRight, RotateCcw } from 'lucide-react'

// ─── CSV Parser ────────────────────────────────────────────────────────────

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  for (const line of lines) {
    if (!line.trim()) continue
    const row: string[] = []
    let inQuotes = false
    let current = ''
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        row.push(current.trim()); current = ''
      } else {
        current += ch
      }
    }
    row.push(current.trim())
    rows.push(row)
  }
  return rows
}

function colLetter(i: number): string {
  let label = ''
  let n = i
  do {
    label = String.fromCharCode(65 + (n % 26)) + label
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return label
}

// ─── Types ─────────────────────────────────────────────────────────────────

export interface FieldDef {
  key: string
  label: string
  required?: boolean
  description?: string
  example?: string
}

export interface ImportRowResult {
  success: boolean
  message: string
}

export interface CsvImporterProps {
  title: string
  description: string
  fields: FieldDef[]
  /** Called once per data row with mapped values. Return success/message. */
  onImportRow: (row: Record<string, string>, rowIndex: number) => Promise<ImportRowResult>
}

type Step = 'upload' | 'map' | 'importing' | 'done'

// ─── Component ─────────────────────────────────────────────────────────────

export function CsvImporter({ title, description, fields, onImportRow }: CsvImporterProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep]               = useState<Step>('upload')
  const [allRows, setAllRows]         = useState<string[][]>([])   // parsed CSV (all rows including header)
  const [hasHeader, setHasHeader]     = useState(true)
  const [mapping, setMapping]         = useState<Record<string, string>>({}) // fieldKey → colIndex string
  const [results, setResults]         = useState<ImportRowResult[]>([])
  const [progress, setProgress]       = useState(0)
  const [fileName, setFileName]       = useState('')

  // Derived
  const headerRow   = hasHeader && allRows.length > 0 ? allRows[0] : null
  const dataRows    = hasHeader ? allRows.slice(1) : allRows
  const colCount    = allRows[0]?.length ?? 0
  const previewRows = dataRows.slice(0, 4)

  const colOptions = Array.from({ length: colCount }, (_, i) => ({
    index: String(i),
    label: headerRow ? `${colLetter(i)} — ${headerRow[i]}` : colLetter(i),
  }))

  function handleFile(file: File) {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const rows = parseCSV(text)
      setAllRows(rows)
      setMapping({})
      setStep('map')
    }
    reader.readAsText(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function getMappedValue(row: string[], fieldKey: string): string {
    const idx = mapping[fieldKey]
    if (idx === undefined || idx === '') return ''
    return row[parseInt(idx)] ?? ''
  }

  async function runImport() {
    setStep('importing')
    setProgress(0)
    const rowResults: ImportRowResult[] = []

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]
      const mapped: Record<string, string> = {}
      for (const field of fields) {
        mapped[field.key] = getMappedValue(row, field.key)
      }
      const result = await onImportRow(mapped, i)
      rowResults.push(result)
      setProgress(i + 1)
    }

    setResults(rowResults)
    setStep('done')
  }

  function reset() {
    setStep('upload')
    setAllRows([])
    setMapping({})
    setResults([])
    setProgress(0)
    setFileName('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const requiredMapped = fields
    .filter(f => f.required)
    .every(f => mapping[f.key] !== undefined && mapping[f.key] !== '')

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl space-y-6">

      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500 mt-1">{description}</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs font-medium">
        {(['upload', 'map', 'importing', 'done'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <ArrowRight className="h-3 w-3 text-slate-300" />}
            <span className={`px-2 py-1 rounded-full ${step === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
              {s === 'upload' ? '1. Upload' : s === 'map' ? '2. Map columns' : s === 'importing' ? '3. Importing…' : '3. Done'}
            </span>
          </div>
        ))}
      </div>

      {/* ── Step 1: Upload ── */}
      {step === 'upload' && (
        <div
          className="border-2 border-dashed border-slate-200 rounded-lg p-12 text-center hover:border-blue-300 transition-colors cursor-pointer"
          onClick={() => fileRef.current?.click()}
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
        >
          <Upload className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-700">Drop a CSV file here, or click to browse</p>
          <p className="text-xs text-slate-400 mt-1">Supports .csv files from any CRM or spreadsheet export</p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
        </div>
      )}

      {/* ── Step 2: Map columns ── */}
      {step === 'map' && (
        <div className="space-y-5">
          {/* File info + header toggle */}
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
            <div className="text-sm">
              <span className="font-medium text-slate-800">{fileName}</span>
              <span className="text-slate-400 ml-2">— {dataRows.length} data row{dataRows.length !== 1 ? 's' : ''} detected</span>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasHeader}
                onChange={e => setHasHeader(e.target.checked)}
                className="rounded"
              />
              First row is a header
            </label>
          </div>

          {/* Mapping table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Match your CSV columns to app fields
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide w-1/3">App Field</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide w-1/3">Your CSV Column</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Example Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {fields.map(field => {
                  const selectedIdx = mapping[field.key]
                  const exampleVal = selectedIdx !== undefined && selectedIdx !== ''
                    ? (previewRows[0]?.[parseInt(selectedIdx)] ?? '')
                    : ''

                  return (
                    <tr key={field.key}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </div>
                        {field.description && (
                          <div className="text-xs text-slate-400 mt-0.5">{field.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          value={mapping[field.key] ?? ''}
                          onChange={e => setMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                        >
                          <option value="">— Skip this field —</option>
                          {colOptions.map(col => (
                            <option key={col.index} value={col.index}>{col.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs font-mono">
                        {exampleVal || <span className="text-slate-300 font-sans">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Preview */}
          {previewRows.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Preview (first {previewRows.length} rows)</p>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {colOptions.map(col => (
                        <th key={col.index} className="text-left px-3 py-2 font-medium text-slate-500 whitespace-nowrap">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewRows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-2 text-slate-700 whitespace-nowrap max-w-[180px] truncate">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={runImport} disabled={!requiredMapped}>
              Import {dataRows.length} row{dataRows.length !== 1 ? 's' : ''}
            </Button>
            <Button variant="outline" onClick={reset}>
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Choose different file
            </Button>
            {!requiredMapped && (
              <p className="text-xs text-amber-600">
                Map all required fields (<span className="text-red-500">*</span>) before importing.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Step 3: Importing ── */}
      {step === 'importing' && (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-sm font-medium text-slate-700">
            Importing row {progress} of {dataRows.length}…
          </p>
          <div className="w-full bg-slate-100 rounded-full h-2 max-w-sm mx-auto">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${(progress / dataRows.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Step 4: Done ── */}
      {step === 'done' && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-green-500 shrink-0" />
              <div>
                <div className="text-2xl font-bold text-green-700">
                  {results.filter(r => r.success).length}
                </div>
                <div className="text-sm text-green-600">imported successfully</div>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
              <XCircle className="h-6 w-6 text-red-400 shrink-0" />
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {results.filter(r => !r.success).length}
                </div>
                <div className="text-sm text-red-500">failed or skipped</div>
              </div>
            </div>
          </div>

          {/* Row-by-row results */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide w-12">Row</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide w-20">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {results.map((r, i) => (
                  <tr key={i} className={r.success ? '' : 'bg-red-50'}>
                    <td className="px-4 py-2 text-slate-400 text-xs">{i + (hasHeader ? 2 : 1)}</td>
                    <td className="px-4 py-2">
                      {r.success
                        ? <span className="text-green-600 text-xs font-medium">✓ OK</span>
                        : <span className="text-red-500 text-xs font-medium">✗ Failed</span>}
                    </td>
                    <td className="px-4 py-2 text-slate-600 text-xs">{r.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button variant="outline" onClick={reset}>
            <RotateCcw className="h-4 w-4 mr-1.5" />
            Import another file
          </Button>
        </div>
      )}
    </div>
  )
}
