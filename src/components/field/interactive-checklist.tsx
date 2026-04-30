'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Check } from 'lucide-react'

interface ChecklistItem {
  id: string
  text: string
}

interface Props {
  entryId: string
  staffId: string
  templateId: string
  title: string
  items: ChecklistItem[]
  initialChecked: string[]
}

export function InteractiveChecklist({
  entryId,
  staffId,
  templateId,
  title,
  items,
  initialChecked,
}: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set(initialChecked))
  const [, startTransition] = useTransition()
  const db = createClient() as any

  function toggle(itemId: string) {
    const next = new Set(checked)
    if (next.has(itemId)) next.delete(itemId)
    else next.add(itemId)
    setChecked(next)

    startTransition(async () => {
      await db.from('checklist_submissions').upsert(
        {
          entry_id: entryId,
          staff_id: staffId,
          template_id: templateId,
          checked_items: Array.from(next),
          completed_at: new Date().toISOString(),
        },
        { onConflict: 'entry_id,staff_id,template_id' }
      )
    })
  }

  return (
    <div className="bg-white border border-[#E8E6E0] rounded-xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 bg-[#FAF8F3] border-b border-[#EFEDE6]">
        <div className="w-[3px] h-3.5 bg-[#F39200]" />
        <p className="text-[13px] font-bold text-[#111111] flex-1">{title}</p>
        <p className="text-[11px] font-bold text-[#6B6B6F]">{checked.size} / {items.length}</p>
      </div>
      <div>
        {items.map((item, idx) => {
          const isChecked = checked.has(item.id)
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-[#FAF8F3] transition-colors ${idx > 0 ? 'border-t border-[#EFEDE6]' : ''}`}
            >
              <div
                className={`h-[18px] w-[18px] rounded-[5px] border-[1.5px] shrink-0 flex items-center justify-center transition-colors ${
                  isChecked
                    ? 'bg-[#F39200] border-[#F39200]'
                    : 'bg-white border-[#CFCDC5]'
                }`}
              >
                {isChecked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
              </div>
              <span
                className={`text-[13px] flex-1 ${
                  isChecked ? 'text-[#9A9A9C] line-through' : 'text-[#4B4B4F]'
                }`}
              >
                {item.text}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
