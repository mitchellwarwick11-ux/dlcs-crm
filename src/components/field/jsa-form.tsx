'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle2, AlertTriangle, RotateCcw } from 'lucide-react'
import { SignatureCanvas, SignatureCanvasHandle } from './signature-canvas'

// ─── SWMS task list from DLCS Risk Assessment ────────────────────────────────
const SWMS_TASKS = [
  'Walking on site',
  'Working with survey level staff',
  'Working alongside waterways or in shallow waterways/creeks and ponds (including treatment plants)',
  'Travel/Arrive work zones',
  'Using the visible laser distancer on Total Station',
  'Digging for sub-surface survey marks',
  'Contaminated sites',
  'Vehicle access to and from work zone',
  'Using spray marker/marker pens/hazardous substance',
  'Working in open excavations',
  'Working alone or without communication',
  'Working on or adjacent to roads (close to traffic)',
  'Exposure to environmental elements',
  'Working near embankments and cuttings',
  'Working in noisy environments',
  'Entry to a Rail Corridor and Danger Zone',
  'Carrying out task in dense vegetation',
  'Removing access lids & covers',
  'Use of personal mobile device on site',
  'Field survey — instrument setup, public area',
  'Working with hand tools',
  'Working with plant and heavy machinery',
  'Packing up equipment at end of task',
  'Working around children',
  'Drone tasks',
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
    additional_hazards: string | null
    signature_data: string | null
  } | null
}

export function JsaForm({ entryId, staffId, staffName, staffRole, jobNumber, existing }: Props) {
  const router = useRouter()
  const sigRef = useRef<SignatureCanvasHandle>(null)

  const [specificSwms,  setSpecificSwms]  = useState(existing?.specific_swms_required ?? false)
  const [selectedTasks, setSelectedTasks] = useState<string[]>(existing?.selected_tasks ?? [])
  const [addHazards,    setAddHazards]    = useState(existing?.additional_hazards ?? '')
  const [hasSig,        setHasSig]        = useState(!!existing?.signature_data)
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [done,          setDone]          = useState(false)

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

    // Upsert — update if exists, insert if new
    const { error: dbErr } = await db
      .from('jsa_submissions')
      .upsert({
        entry_id:               entryId,
        staff_id:               staffId,
        specific_swms_required: specificSwms,
        selected_tasks:         selectedTasks,
        additional_hazards:     addHazards.trim() || null,
        signature_data:         signatureData,
        updated_at:             new Date().toISOString(),
      }, { onConflict: 'entry_id,staff_id' })

    if (dbErr) {
      setError('Failed to save. Please try again.')
      setSaving(false)
      return
    }

    setDone(true)
    router.refresh()
    setTimeout(() => router.push(`/field/${entryId}`), 1500)
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-8 text-center">
        <CheckCircle2 className="h-14 w-14 text-green-500 mb-4" />
        <p className="text-lg font-bold text-slate-800">Risk Assessment Submitted</p>
        <p className="text-sm text-slate-500 mt-1">Returning to job hub…</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 py-5 space-y-6">

        {/* Job reference */}
        <div className="bg-slate-50 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Job Reference</p>
          <p className="text-base font-bold text-slate-900 mt-0.5">{jobNumber}</p>
          <p className="text-sm text-slate-600">{staffName} · {staffRole}</p>
        </div>

        {/* Specific SWMS required? */}
        <div>
          <p className="text-sm font-semibold text-slate-800 mb-2">Specific SWMS required for this job?</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setSpecificSwms(false)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                !specificSwms
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-300'
              }`}
            >
              No
            </button>
            <button
              type="button"
              onClick={() => setSpecificSwms(true)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                specificSwms
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-slate-600 border-slate-300'
              }`}
            >
              Yes
            </button>
          </div>
          {specificSwms && (
            <div className="mt-3 flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-xl">
              <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
              <p className="text-sm text-orange-700">
                A specific SWMS is required. Contact the Project Manager before commencing work.
              </p>
            </div>
          )}
        </div>

        {/* Task selection */}
        <div>
          <p className="text-sm font-semibold text-slate-800 mb-1">
            Select all applicable site tasks &amp; conditions
          </p>
          <p className="text-xs text-slate-400 mb-3">
            Only select items relevant to this job. {selectedTasks.length > 0 && `${selectedTasks.length} selected.`}
          </p>
          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
            {SWMS_TASKS.map(task => {
              const checked = selectedTasks.includes(task)
              return (
                <label
                  key={task}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer select-none transition-colors ${
                    checked ? 'bg-blue-50' : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleTask(task)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                  />
                  <span className={`text-sm leading-snug ${checked ? 'text-blue-800 font-medium' : 'text-slate-700'}`}>
                    {task}
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        {/* Additional hazards */}
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-2">
            Additional hazards &amp; risks
            <span className="text-slate-400 font-normal ml-1">(optional)</span>
          </label>
          <textarea
            rows={3}
            value={addHazards}
            onChange={e => setAddHazards(e.target.value)}
            placeholder="Describe any site-specific hazards not listed above…"
            className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Sign-off declaration */}
        <div>
          <p className="text-sm font-semibold text-slate-800 mb-2">Declaration</p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{SIGNOFF_TEXT}</p>
          </div>
        </div>

        {/* Signature */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-800">Signature</p>
            <button
              type="button"
              onClick={() => { sigRef.current?.clear(); setHasSig(false) }}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Clear
            </button>
          </div>

          {/* Show existing signature preview if re-editing and canvas is clear */}
          {existing?.signature_data && !hasSig && (
            <div className="mb-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-xs text-slate-400 mb-1">Existing signature (draw below to replace)</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={existing.signature_data} alt="Previous signature" className="h-16 object-contain" />
            </div>
          )}

          <div className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white">
            <SignatureCanvas
              ref={sigRef}
              className="w-full h-32 block"
              onDraw={() => setHasSig(true)}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1 text-center">Sign with your finger or stylus</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? 'Submitting…' : 'Submit Risk Assessment'}
        </button>

        <div className="pb-8" />
      </div>
    </div>
  )
}
