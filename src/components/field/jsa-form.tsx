'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle2, AlertTriangle, RotateCcw, Plus, Trash2 } from 'lucide-react'
import { SignatureCanvas, SignatureCanvasHandle } from './signature-canvas'
import { RiskMatrixPicker } from './risk-matrix-picker'
import {
  type RiskRating,
  rateRisk,
  isValidRating,
  BUCKET_COLORS,
  CONSEQUENCE_LABELS,
  PROBABILITY_LABELS,
} from './risk-matrix'

export interface AdditionalHazard {
  procedure:          string
  hazard:             string
  risk:               RiskRating | null
  control_measures:   string
  residual:           RiskRating | null
  person_responsible: string
}

function emptyHazard(): AdditionalHazard {
  return {
    procedure:          '',
    hazard:             '',
    risk:               null,
    control_measures:   '',
    residual:           null,
    person_responsible: '',
  }
}

// Defensively coerce whatever shape comes back from the DB into AdditionalHazard[].
function normaliseHazards(raw: unknown): AdditionalHazard[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item: any) => ({
    procedure:          typeof item?.procedure === 'string' ? item.procedure : '',
    hazard:             typeof item?.hazard === 'string' ? item.hazard : '',
    risk:               isValidRating(item?.risk) ? item.risk : null,
    control_measures:   typeof item?.control_measures === 'string' ? item.control_measures : '',
    residual:           isValidRating(item?.residual) ? item.residual : null,
    person_responsible: typeof item?.person_responsible === 'string' ? item.person_responsible : '',
  }))
}

// ─── SWMS task list from DLCS Risk Assessment ────────────────────────────────
const SWMS_TASKS = [
  'SWMS unsuitable for task',
  'Travel/Arrive work zones',
  'Vehicle access to and from work zone',
  'Working on or adjacent to roads (close to traffic)',
  'Entry to a Rail Corridor and Danger Zone',
  'Field survey – instrument setup, public area, electrical equipment checked',
  'Working around children',
  'Walking on site',
  'Using the visible laser distancer on Total Station',
  'Using spray marker/marker pens/hazardous substance',
  'Exposure to environmental elements',
  'Carrying out task in dense vegetation',
  'Working with hand tools',
  'Working with survey level staff',
  'Digging for sub-surface survey marks',
  'Working in open excavations',
  'Working near embankments and cuttings',
  'Removing access lids & covers',
  'Working with plant and heavy machinery',
  'Drone tasks',
  'Working alongside waterways or in shallow waterways/creeks and ponds (including treatment plants)',
  'Contaminated sites',
  'Working alone or without communication',
  'Working in noisy environments',
  'Use of personal mobile device on site',
  'Packing up equipment at end of task',
  'Climate impact',
]

const SIGNOFF_TEXT = `I confirm that:
• The SWMS nominated has been explained and its contents are clearly understood and accepted.
• My required qualifications to undertake this activity are current.
• I clearly understand the controls in this SWMS must be applied as documented; otherwise, work is to cease immediately.
• The nominated manager is responsible for OHS on this job/site and I will contact them immediately if any issues arise.`

interface Props {
  entryId:    string
  staffId:    string
  staffName:  string
  staffRole:  string
  jobNumber:  string
  // Pre-fill if re-submitting
  existing?: {
    specific_swms_required: boolean
    selected_tasks: string[]
    additional_hazards: AdditionalHazard[] | unknown
    signature_data: string | null
  } | null
}

export function JsaForm({ entryId, staffId, staffName, staffRole, jobNumber, existing }: Props) {
  const router = useRouter()
  const sigRef = useRef<SignatureCanvasHandle>(null)

  const initialHazards = normaliseHazards(existing?.additional_hazards)

  const [specificSwms,    setSpecificSwms]    = useState(existing?.specific_swms_required ?? false)
  const [selectedTasks,   setSelectedTasks]   = useState<string[]>(existing?.selected_tasks ?? [])
  const [hazardsEnabled,  setHazardsEnabled]  = useState(initialHazards.length > 0)
  const [hazards,         setHazards]         = useState<AdditionalHazard[]>(
    initialHazards.length > 0 ? initialHazards : [emptyHazard()],
  )
  const [picker, setPicker] = useState<{ index: number; kind: 'risk' | 'residual' } | null>(null)
  const [hasSig,        setHasSig]        = useState(!!existing?.signature_data)
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [done,          setDone]          = useState(false)

  function updateHazard(index: number, patch: Partial<AdditionalHazard>) {
    setHazards(prev => prev.map((h, i) => (i === index ? { ...h, ...patch } : h)))
  }

  function addHazardRow() {
    setHazards(prev => [...prev, emptyHazard()])
  }

  function removeHazardRow(index: number) {
    setHazards(prev => {
      const next = prev.filter((_, i) => i !== index)
      return next.length === 0 ? [emptyHazard()] : next
    })
  }

  function isHazardRowEmpty(h: AdditionalHazard): boolean {
    return (
      !h.procedure.trim() &&
      !h.hazard.trim() &&
      !h.control_measures.trim() &&
      !h.person_responsible.trim() &&
      !h.risk &&
      !h.residual
    )
  }

  function toggleTask(task: string) {
    setSelectedTasks(prev =>
      prev.includes(task) ? prev.filter(t => t !== task) : [...prev, task]
    )
  }

  async function handleSubmit() {
    if (!hasSig && !sigRef.current?.isEmpty() === false) {
      // If they just drew — check current state
    }
    const isEmpty = sigRef.current?.isEmpty() ?? true
    // Allow resubmit with existing signature even if canvas is empty (showing old sig)
    if (isEmpty && !existing?.signature_data) {
      setError('Please sign the form before submitting.')
      return
    }

    setSaving(true)
    setError(null)

    const signatureData = isEmpty
      ? (existing?.signature_data ?? null)
      : (sigRef.current?.toDataURL() ?? null)

    const db = createClient() as any

    const hazardsToSave = hazardsEnabled
      ? hazards.filter(h => !isHazardRowEmpty(h))
      : []

    // Upsert — update if exists, insert if new
    const { error: dbErr } = await db
      .from('jsa_submissions')
      .upsert({
        entry_id:               entryId,
        staff_id:               staffId,
        specific_swms_required: specificSwms,
        selected_tasks:         selectedTasks,
        additional_hazards:     hazardsToSave,
        signature_data:         signatureData,
        updated_at:             new Date().toISOString(),
      }, { onConflict: 'entry_id,staff_id' })

    if (dbErr) {
      setError('Failed to save. Please try again.')
      setSaving(false)
      return
    }

    // Generate the signed Risk Assessment PDF and drop it on the project's
    // Documents page. Don't block the user if this fails — they can re-submit.
    try {
      const res = await fetch(`/api/jsa/${entryId}/pdf`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        // eslint-disable-next-line no-console
        console.warn('Risk assessment PDF generation failed', body)
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Risk assessment PDF generation error', err)
    }

    setDone(true)
    router.refresh()
    setTimeout(() => router.push(`/field/${entryId}`), 1500)
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-8 text-center bg-[#E8E5DC]">
        <CheckCircle2 className="h-14 w-14 text-[#1F7A3F] mb-4" />
        <p className="text-lg font-bold text-[#111111]">Risk Assessment Submitted</p>
        <p className="text-sm text-[#6B6B6F] mt-1">Returning to job hub…</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#E8E5DC]">
      <div className="px-5 py-5 space-y-6">

        {/* Job reference */}
        <div className="bg-white border border-[#D6D2C7] rounded-xl p-4">
          <p className="text-[10px] text-[#F39200] tracking-[0.18em] font-bold uppercase">Signed by</p>
          <p className="text-[15px] font-bold text-[#111111] mt-1">{staffName}</p>
          <p className="text-[12px] text-[#6B6B6F]">{staffRole} · {jobNumber}</p>
        </div>

        {/* Specific SWMS required? */}
        <div>
          <p className="text-[11px] font-bold text-[#F39200] tracking-[0.18em] uppercase mb-2.5">Specific SWMS required?</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setSpecificSwms(false)}
              className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-colors ${
                !specificSwms
                  ? 'bg-[#111111] text-white border-[#111111]'
                  : 'bg-white text-[#4B4B4F] border-[#D6D2C7]'
              }`}
            >
              No
            </button>
            <button
              type="button"
              onClick={() => setSpecificSwms(true)}
              className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-colors ${
                specificSwms
                  ? 'bg-[#111111] text-white border-[#111111]'
                  : 'bg-white text-[#4B4B4F] border-[#D6D2C7]'
              }`}
            >
              Yes
            </button>
          </div>
          {specificSwms && (
            <div className="mt-3 flex items-start gap-2 p-3 bg-[#FBF1D8] border border-[#F0D890] rounded-xl">
              <AlertTriangle className="h-4 w-4 text-[#A86B0C] mt-0.5 shrink-0" />
              <p className="text-sm text-[#A86B0C]">
                A specific SWMS is required. Contact the Project Manager before commencing work.
              </p>
            </div>
          )}
        </div>

        {/* Task selection */}
        <div>
          <div className="flex items-end justify-between mb-2.5">
            <div>
              <p className="text-[11px] font-bold text-[#F39200] tracking-[0.18em] uppercase">Site tasks &amp; conditions</p>
              <p className="text-[11px] text-[#6B6B6F] mt-0.5">Select all that apply</p>
            </div>
            {selectedTasks.length > 0 && (
              <span className="text-[11px] font-semibold bg-[#111111] text-[#F39200] px-2.5 py-1 rounded-full">
                {selectedTasks.length} selected
              </span>
            )}
          </div>
          <div className="border border-[#D6D2C7] rounded-xl overflow-hidden bg-white">
            {SWMS_TASKS.map((task, idx) => {
              const checked = selectedTasks.includes(task)
              return (
                <label
                  key={task}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer select-none transition-colors ${idx > 0 ? 'border-t border-[#EFEDE6]' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleTask(task)}
                    className="mt-0.5 h-[18px] w-[18px] rounded accent-[#111111] shrink-0"
                  />
                  <span className={`text-[13px] leading-snug ${checked ? 'text-[#111111] font-semibold' : 'text-[#4B4B4F]'}`}>
                    {task}
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        {/* Additional hazards (structured) */}
        <div>
          <label className="flex items-start gap-3 cursor-pointer select-none bg-white border border-[#D6D2C7] rounded-xl px-4 py-3">
            <input
              type="checkbox"
              checked={hazardsEnabled}
              onChange={e => setHazardsEnabled(e.target.checked)}
              className="mt-0.5 h-[18px] w-[18px] rounded accent-[#111111] shrink-0"
            />
            <span>
              <span className="block text-[13px] font-semibold text-[#111111]">
                Additional hazards & risks requiring attention control measures
              </span>
              <span className="block text-[11px] text-[#6B6B6F] mt-0.5">
                Tick if site-specific hazards beyond the SWMS need to be recorded.
              </span>
            </span>
          </label>

          {hazardsEnabled && (
            <div className="mt-3 space-y-3">
              {hazards.map((h, i) => (
                <HazardCard
                  key={i}
                  index={i}
                  hazard={h}
                  canRemove={hazards.length > 1}
                  onChange={patch => updateHazard(i, patch)}
                  onRemove={() => removeHazardRow(i)}
                  onPickRisk={() => setPicker({ index: i, kind: 'risk' })}
                  onPickResidual={() => setPicker({ index: i, kind: 'residual' })}
                />
              ))}
              <button
                type="button"
                onClick={addHazardRow}
                className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-[#C7C5BE] rounded-xl text-sm font-semibold text-[#4B4B4F] hover:bg-white transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add another hazard
              </button>
            </div>
          )}
        </div>

        {/* Sign-off declaration */}
        <div>
          <p className="text-[11px] font-bold text-[#F39200] tracking-[0.18em] uppercase mb-2">Declaration</p>
          <div className="bg-white border border-[#D6D2C7] rounded-xl p-4">
            <p className="text-xs text-[#4B4B4F] leading-relaxed whitespace-pre-line">{SIGNOFF_TEXT}</p>
          </div>
        </div>

        {/* Signature */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold text-[#F39200] tracking-[0.18em] uppercase">Signature</p>
            <button
              type="button"
              onClick={() => { sigRef.current?.clear(); setHasSig(false) }}
              className="flex items-center gap-1 text-xs text-[#9A9A9C] hover:text-[#4B4B4F] transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Clear
            </button>
          </div>

          <div className="border border-[#D6D2C7] rounded-xl overflow-hidden bg-white">
            <SignatureCanvas
              ref={sigRef}
              className="w-full h-32 block"
              onDraw={() => setHasSig(true)}
              initialDataUrl={existing?.signature_data ?? null}
            />
          </div>
          <p className="text-xs text-[#9A9A9C] mt-1 text-center">
            {existing?.signature_data && hasSig
              ? 'Tap Clear to re-sign'
              : 'Sign with your finger or stylus'}
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-[#F8E4E4] border border-[#E9B7B7] rounded-xl">
            <AlertTriangle className="h-4 w-4 text-[#A31D1D] shrink-0" />
            <p className="text-sm text-[#A31D1D]">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="w-full py-3.5 bg-[#111111] hover:bg-black disabled:bg-[#4B4B4F] text-white font-semibold rounded-full text-sm transition-colors flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin text-[#F39200]" /> : <ShieldCheckIcon />}
          {saving ? 'Submitting…' : 'Submit Risk Assessment'}
        </button>

        <div className="pb-8" />
      </div>

      <RiskMatrixPicker
        open={picker !== null}
        title={picker?.kind === 'residual' ? 'Residual Risk Rating' : 'Risk Rating'}
        current={picker ? hazards[picker.index]?.[picker.kind] ?? null : null}
        onClose={() => setPicker(null)}
        onPick={rating => {
          if (!picker) return
          updateHazard(picker.index, { [picker.kind]: rating } as Partial<AdditionalHazard>)
          setPicker(null)
        }}
      />
    </div>
  )
}

interface HazardCardProps {
  index:          number
  hazard:         AdditionalHazard
  canRemove:      boolean
  onChange:       (patch: Partial<AdditionalHazard>) => void
  onRemove:       () => void
  onPickRisk:     () => void
  onPickResidual: () => void
}

function HazardCard({ index, hazard, canRemove, onChange, onRemove, onPickRisk, onPickResidual }: HazardCardProps) {
  return (
    <div className="bg-white border border-[#D6D2C7] rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-[#F39200] font-bold tracking-[0.18em] uppercase">Hazard {index + 1}</p>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center gap-1 text-xs text-[#9A9A9C] hover:text-[#A31D1D] transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        )}
      </div>

      <FieldTextarea
        label="Procedure"
        sub="Break the job down into steps"
        value={hazard.procedure}
        onChange={v => onChange({ procedure: v })}
      />

      <FieldTextarea
        label="Potential safety & environmental hazards"
        sub="What can go wrong"
        value={hazard.hazard}
        onChange={v => onChange({ hazard: v })}
      />

      <RatingField
        label="Risk rating"
        sub="Tap to open matrix"
        rating={hazard.risk}
        onClick={onPickRisk}
      />

      <FieldTextarea
        label="Control measures"
        sub="How will the risk be managed"
        value={hazard.control_measures}
        onChange={v => onChange({ control_measures: v })}
      />

      <RatingField
        label="Residual risk rating"
        sub="After controls are applied"
        rating={hazard.residual}
        onClick={onPickResidual}
      />

      <FieldInput
        label="Person responsible"
        sub="To ensure management method applied"
        value={hazard.person_responsible}
        onChange={v => onChange({ person_responsible: v })}
      />
    </div>
  )
}

function FieldLabel({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="mb-1.5">
      <p className="text-[11px] font-bold text-[#111111] uppercase tracking-wide">{label}</p>
      {sub && <p className="text-[10px] text-[#9A9A9C] mt-0.5">{sub}</p>}
    </div>
  )
}

function FieldTextarea({
  label, sub, value, onChange,
}: { label: string; sub?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <FieldLabel label={label} sub={sub} />
      <textarea
        rows={2}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-[#D6D2C7] bg-[#FAFAF8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F39200] resize-y"
      />
    </div>
  )
}

function FieldInput({
  label, sub, value, onChange,
}: { label: string; sub?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <FieldLabel label={label} sub={sub} />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-[#D6D2C7] bg-[#FAFAF8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F39200]"
      />
    </div>
  )
}

function RatingField({
  label, sub, rating, onClick,
}: { label: string; sub?: string; rating: RiskRating | null; onClick: () => void }) {
  if (!rating) {
    return (
      <div>
        <FieldLabel label={label} sub={sub} />
        <button
          type="button"
          onClick={onClick}
          className="w-full flex items-center justify-between border border-dashed border-[#C7C5BE] bg-[#FAFAF8] rounded-lg px-3 py-2.5 text-sm text-[#6B6B6F] hover:bg-white transition-colors"
        >
          <span>Tap to set rating</span>
          <span className="text-xs font-semibold text-[#9A9A9C]">Open matrix →</span>
        </button>
      </div>
    )
  }

  const bucket = rateRisk(rating.c, rating.p)
  const colors = BUCKET_COLORS[bucket]
  return (
    <div>
      <FieldLabel label={label} sub={sub} />
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center gap-3 border border-[#D6D2C7] bg-[#FAFAF8] rounded-lg px-3 py-2 text-sm hover:bg-white transition-colors"
      >
        <span
          className="px-2.5 py-1 rounded-md text-sm font-bold shrink-0"
          style={{ backgroundColor: colors.bg, color: colors.fg, border: `1px solid ${colors.border}` }}
        >
          {bucket}
        </span>
        <span className="flex-1 text-left text-[12px] text-[#4B4B4F] leading-tight">
          <span className="block font-semibold text-[#111111]">{CONSEQUENCE_LABELS[rating.c].full}</span>
          <span className="block text-[#6B6B6F]">{PROBABILITY_LABELS[rating.p].full}</span>
        </span>
        <span className="text-xs font-semibold text-[#9A9A9C] shrink-0">Change</span>
      </button>
    </div>
  )
}

function ShieldCheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F39200" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  )
}
