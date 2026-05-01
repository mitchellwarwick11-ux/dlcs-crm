'use client'

import { useState, useMemo, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calculator, GripVertical, Plus, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import type { QuoteTask, QuoteItemsHeading, RoleRate } from '@/types/database'

export interface TaskImportOption {
  /** Unique key (e.g. `${templateId}:${taskIndex}`) */
  id: string
  /** Human label shown in the picker — e.g. "Contour & Detail Survey — Standard" */
  label: string
  /** The task to append when selected. Deep-cloned before insertion. */
  task: QuoteTask
}

export interface TaskBodyEditorProps {
  tasks: QuoteTask[]
  onChange: (tasks: QuoteTask[]) => void
  /** Show price input per task (fee proposal side). Templates hide this. */
  showPrices?: boolean
  /** Optional predefined tasks that can be appended via a picker next to "Add Quote Task". */
  importOptions?: TaskImportOption[]
  /** When provided, a calculator icon appears next to each task price input that opens a role-hours estimator. */
  roleRates?: RoleRate[]
}

export function newEmptyTask(): QuoteTask {
  return {
    title: '',
    price: null,
    itemsHeadings: [{ heading: '', lines: [''] }],
  }
}

function cloneTask(t: QuoteTask): QuoteTask {
  return {
    title: t.title,
    price: t.price,
    itemsHeadings: t.itemsHeadings.map(h => ({ heading: h.heading, lines: [...h.lines] })),
  }
}

export function TaskBodyEditor({ tasks, onChange, showPrices = false, importOptions, roleRates }: TaskBodyEditorProps) {

  // Drag state: which line is being dragged (ti-hi-li) and which is currently hovered.
  const [dragging, setDragging] = useState<{ ti: number; hi: number; li: number } | null>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  // Index of the task whose calculator dialog is open, or null when closed.
  const [calcForTask, setCalcForTask] = useState<number | null>(null)

  function reorderLines(ti: number, hi: number, from: number, to: number) {
    if (from === to) return
    const lines = [...tasks[ti].itemsHeadings[hi].lines]
    const [moved] = lines.splice(from, 1)
    lines.splice(to, 0, moved)
    updateHeading(ti, hi, { lines })
  }

  function updateTask(i: number, patch: Partial<QuoteTask>) {
    onChange(tasks.map((t, idx) => idx === i ? { ...t, ...patch } : t))
  }

  function updateHeading(ti: number, hi: number, patch: Partial<QuoteItemsHeading>) {
    updateTask(ti, {
      itemsHeadings: tasks[ti].itemsHeadings.map((h, idx) => idx === hi ? { ...h, ...patch } : h),
    })
  }

  function updateLine(ti: number, hi: number, li: number, value: string) {
    const lines = tasks[ti].itemsHeadings[hi].lines.map((l, idx) => idx === li ? value : l)
    updateHeading(ti, hi, { lines })
  }

  function addTask() {
    onChange([...tasks, newEmptyTask()])
  }

  function removeTask(i: number) {
    onChange(tasks.filter((_, idx) => idx !== i))
  }

  function addHeading(ti: number) {
    updateTask(ti, {
      itemsHeadings: [...tasks[ti].itemsHeadings, { heading: '', lines: [''] }],
    })
  }

  function removeHeading(ti: number, hi: number) {
    updateTask(ti, {
      itemsHeadings: tasks[ti].itemsHeadings.filter((_, idx) => idx !== hi),
    })
  }

  function addLine(ti: number, hi: number) {
    const heading = tasks[ti].itemsHeadings[hi]
    updateHeading(ti, hi, { lines: [...heading.lines, ''] })
  }

  function removeLine(ti: number, hi: number, li: number) {
    const heading = tasks[ti].itemsHeadings[hi]
    updateHeading(ti, hi, { lines: heading.lines.filter((_, idx) => idx !== li) })
  }

  return (
    <div className="space-y-4">
      {tasks.map((task, ti) => (
        <div key={ti} className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">

          {/* Task header — title spans full width (mirrors the preview's bold task title) */}
          <div className="flex items-start gap-2">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_140px] gap-2">
              <Input
                className="bg-white text-base font-bold uppercase tracking-wide"
                value={task.title}
                onChange={e => updateTask(ti, { title: e.target.value })}
                placeholder={`Quote Task ${ti + 1} title`}
              />
              {showPrices && (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                  <Input
                    className={`bg-white pl-6 text-right font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${roleRates && roleRates.length > 0 ? 'pr-9' : ''}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={task.price ?? ''}
                    onChange={e => updateTask(ti, { price: e.target.value === '' ? null : parseFloat(e.target.value) })}
                  />
                  {roleRates && roleRates.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCalcForTask(ti)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                      title="Estimate from role hours"
                      aria-label="Open price calculator"
                    >
                      <Calculator className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
            {tasks.length > 1 && (
              <button
                type="button"
                onClick={() => removeTask(ti)}
                className="text-slate-400 hover:text-red-500 transition-colors shrink-0 pt-2"
                title="Remove task"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Items headings — 2-column layout matching the preview:
              [heading label on the left] | [info lines on the right] */}
          <div className="space-y-3">
            {task.itemsHeadings.map((heading, hi) => (
              <div key={hi} className="grid grid-cols-[140px_1fr] gap-3 items-start">
                {/* Heading (left column, styled like the preview label) */}
                <div className="space-y-1">
                  <textarea
                    className="w-full rounded-lg border border-input bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500 leading-snug resize-none outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 break-words"
                    rows={2}
                    value={heading.heading}
                    onChange={e => updateHeading(ti, hi, { heading: e.target.value })}
                    placeholder="ITEMS HEADING"
                  />
                  {task.itemsHeadings.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeHeading(ti, hi)}
                      className="text-slate-400 hover:text-red-500 transition-colors text-xs flex items-center gap-1"
                      title="Remove items heading"
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove
                    </button>
                  )}
                </div>

                {/* Info lines (right column) — drag to reorder */}
                <div className="space-y-1 border-l border-slate-100 pl-3">
                  {heading.lines.map((line, li) => {
                    const isDragging = dragging?.ti === ti && dragging.hi === hi && dragging.li === li
                    const isHoverTarget = dragging?.ti === ti && dragging.hi === hi && hoverIdx === li && !isDragging
                    return (
                      <div
                        key={li}
                        className={`flex items-center gap-2 rounded-md transition-colors ${isHoverTarget ? 'bg-violet-50 ring-1 ring-violet-200' : ''} ${isDragging ? 'opacity-40' : ''}`}
                        onDragOver={e => {
                          if (dragging?.ti === ti && dragging.hi === hi) {
                            e.preventDefault()
                            setHoverIdx(li)
                          }
                        }}
                        onDrop={e => {
                          e.preventDefault()
                          if (dragging?.ti === ti && dragging.hi === hi) {
                            reorderLines(ti, hi, dragging.li, li)
                          }
                          setDragging(null)
                          setHoverIdx(null)
                        }}
                      >
                        <button
                          type="button"
                          draggable
                          onDragStart={e => {
                            setDragging({ ti, hi, li })
                            e.dataTransfer.effectAllowed = 'move'
                            // Firefox needs data to initiate the drag.
                            e.dataTransfer.setData('text/plain', String(li))
                          }}
                          onDragEnd={() => { setDragging(null); setHoverIdx(null) }}
                          className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0 px-0.5"
                          title="Drag to reorder"
                          aria-label="Drag to reorder"
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                        </button>
                        <Input
                          className="bg-white text-sm"
                          value={line}
                          onChange={e => updateLine(ti, hi, li, e.target.value)}
                          placeholder="Quote task information"
                        />
                        {heading.lines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLine(ti, hi, li)}
                            className="text-slate-300 hover:text-red-500 transition-colors shrink-0"
                            title="Remove info line"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addLine(ti, hi)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add info line
                  </Button>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addHeading(ti)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add items heading
            </Button>
          </div>
        </div>
      ))}

      <div className="flex gap-2">
        {importOptions && importOptions.length > 0 && (
          <div className="relative flex-1 min-w-0">
            {/* Styled to match the primary "New Job" button — pill, dark, with a chevron. */}
            <select
              value=""
              onChange={e => {
                const picked = importOptions.find(o => o.id === e.target.value)
                if (picked) onChange([...tasks, cloneTask(picked.task)])
                e.target.value = ''
              }}
              className="appearance-none rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium pl-10 pr-9 h-10 w-full shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400 cursor-pointer"
              title="Add a Quote Task from a predefined template"
            >
              <option value="" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>Add Quote Task (Template)</option>
              {importOptions.map(o => (
                <option key={o.id} value={o.id} style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>{o.label}</option>
              ))}
            </select>
            <Plus className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-400 pointer-events-none" />
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-white pointer-events-none" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 4.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={addTask}
          className="flex-1"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add Quote Task (Blank)
        </Button>
        {/* Calculator dialog — opens for the active task index */}
        {roleRates && roleRates.length > 0 && (
          <PriceCalculatorDialog
            open={calcForTask !== null}
            onOpenChange={(open) => { if (!open) setCalcForTask(null) }}
            roleRates={roleRates}
            onApply={(total) => {
              if (calcForTask !== null) updateTask(calcForTask, { price: total })
              setCalcForTask(null)
            }}
          />
        )}
      </div>
    </div>
  )
}

interface PriceCalculatorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  roleRates: RoleRate[]
  onApply: (total: number) => void
}

function PriceCalculatorDialog({ open, onOpenChange, roleRates, onApply }: PriceCalculatorDialogProps) {
  const activeRoles = useMemo(
    () => roleRates.filter(r => r.is_active).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [roleRates]
  )

  // Hours keyed by role id. Reset whenever the dialog opens.
  const [hours, setHours] = useState<Record<string, string>>({})

  // Reset hours each time the dialog opens.
  useEffect(() => { if (open) setHours({}) }, [open])

  const total = activeRoles.reduce((sum, r) => {
    const h = parseFloat(hours[r.id] || '0')
    if (isNaN(h) || h <= 0) return sum
    return sum + h * Number(r.hourly_rate)
  }, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Estimate price from role hours</DialogTitle>
          <DialogDescription>
            Enter the hours for each role; the total will populate the task amount. You can still edit it afterwards.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-1">
          {activeRoles.map(role => {
            const h = parseFloat(hours[role.id] || '0')
            const rowTotal = !isNaN(h) && h > 0 ? h * Number(role.hourly_rate) : 0
            return (
              <div key={role.id} className="grid grid-cols-[1fr_90px_90px] items-center gap-3 px-3 py-2 rounded-md border border-slate-200 bg-white">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{role.label}</p>
                  <p className="text-xs text-slate-400">${Number(role.hourly_rate).toFixed(2)}/hr</p>
                </div>
                <Input
                  type="number"
                  min="0"
                  step="0.25"
                  inputMode="decimal"
                  placeholder="0"
                  value={hours[role.id] ?? ''}
                  onChange={e => setHours(prev => ({ ...prev, [role.id]: e.target.value }))}
                  className="h-8 text-sm text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <p className="text-sm text-slate-700 text-right tabular-nums">
                  {rowTotal > 0 ? `$${rowTotal.toFixed(2)}` : <span className="text-slate-300">—</span>}
                </p>
              </div>
            )
          })}
          {activeRoles.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">No active roles configured. Add roles in Settings.</p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 pt-3">
          <span className="text-sm font-medium text-slate-500">Total</span>
          <span className="text-lg font-bold text-slate-900 tabular-nums">${total.toFixed(2)}</span>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={() => onApply(Number(total.toFixed(2)))} disabled={total <= 0}>
            Apply ${total.toFixed(2)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
