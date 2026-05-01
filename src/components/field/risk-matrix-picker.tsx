'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import {
  type RiskRating,
  type ConsequenceLevel,
  type ProbabilityLevel,
  CONSEQUENCE_LABELS,
  PROBABILITY_LABELS,
  BUCKET_COLORS,
  rateRisk,
} from './risk-matrix'

interface Props {
  open:    boolean
  title:   string
  current: RiskRating | null
  onClose: () => void
  onPick:  (rating: RiskRating) => void
}

export function RiskMatrixPicker({ open, title, current, onClose, onPick }: Props) {
  // Lock body scroll while modal is open.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open) return null

  const consequences: ConsequenceLevel[] = [1, 2, 3, 4]
  const probabilities: ProbabilityLevel[] = [1, 2, 3, 4]

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm">
      <div className="flex-1" onClick={onClose} />
      <div className="bg-[#E8E5DC] rounded-t-2xl pb-safe-bottom max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#E8E5DC] z-10 px-4 pt-4 pb-3 flex items-start justify-between border-b border-[#D6D2C7]">
          <div>
            <p className="text-[10px] text-[#F39200] font-bold tracking-[0.18em] uppercase">Tap to select</p>
            <h2 className="text-base font-bold text-[#111111] mt-0.5">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 -mr-1.5 rounded-lg text-[#6B6B6F] hover:bg-[#D6D2C7] transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-3 py-4">
          {/* Matrix */}
          <div className="bg-white border border-[#D6D2C7] rounded-xl overflow-hidden">
            {/* Top-left corner + consequence headers */}
            <div className="flex">
              <div className="w-[78px] shrink-0 bg-[#EFEDE6] border-b border-r border-[#D6D2C7] p-2">
                <p className="text-[9px] font-bold text-[#6B6B6F] tracking-[0.12em] uppercase leading-tight">
                  Probability ↓<br/>Consequence →
                </p>
              </div>
              <div className="flex-1 grid grid-cols-4">
                {consequences.map(c => {
                  const lbl = CONSEQUENCE_LABELS[c]
                  return (
                    <div
                      key={c}
                      className="bg-[#A7E5C1] border-b border-r border-[#D6D2C7] last:border-r-0 p-1.5 text-center"
                    >
                      <p className="text-[10px] font-bold text-[#1F1F22] leading-tight">{lbl.short}</p>
                      <p className="text-[8px] text-[#1F1F22]/70 leading-snug mt-0.5">{lbl.sub}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Probability rows */}
            {probabilities.map((p, ri) => {
              const plbl = PROBABILITY_LABELS[p]
              const isLast = ri === probabilities.length - 1
              return (
                <div key={p} className="flex">
                  <div className={`w-[78px] shrink-0 bg-[#EFEDE6] border-r border-[#D6D2C7] p-1.5 flex flex-col justify-center ${isLast ? '' : 'border-b'}`}>
                    <p className="text-[10px] font-bold text-[#1F1F22] leading-tight">{plbl.full}</p>
                    <p className="text-[8px] text-[#1F1F22]/70 leading-snug mt-0.5">{plbl.sub}</p>
                  </div>
                  <div className="flex-1 grid grid-cols-4">
                    {consequences.map((c, ci) => {
                      const bucket = rateRisk(c, p)
                      const colors = BUCKET_COLORS[bucket]
                      const selected = current?.c === c && current?.p === p
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => onPick({ c, p })}
                          className={`
                            relative aspect-square flex items-center justify-center
                            border-r border-[#D6D2C7] last:border-r-0
                            ${isLast ? '' : 'border-b'}
                            transition-transform active:scale-95
                            ${selected ? 'ring-[3px] ring-[#111111] ring-inset z-10' : ''}
                          `}
                          style={{ backgroundColor: colors.bg, color: colors.fg }}
                          aria-label={`${plbl.full}, ${CONSEQUENCE_LABELS[c].full}: ${bucket}`}
                          aria-pressed={selected}
                        >
                          <span className="text-sm font-bold">{bucket}</span>
                          {ci === 0 && ri === 0 /* invisible spacer disabled */ && null}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          <p className="text-[11px] text-[#6B6B6F] mt-3 text-center px-2">
            Pick a cell to record consequence × probability. Result is the risk rating.
          </p>
        </div>
      </div>
    </div>
  )
}
