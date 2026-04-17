'use client'

import { useState, useRef, useEffect } from 'react'
import { Loader2, MapPin, Search } from 'lucide-react'

export interface AddressSuggestion {
  label:         string
  streetAddress: string
  suburb:        string
  state?:        string
  postcode?:     string
  propid?:       number | null
  // Enriched on selection via /api/property-details:
  lot?:          string | null
  section?:      string | null
  planLabel?:    string | null
  lga?:          string | null
  parish?:       string | null
  county?:       string | null
}

interface Props {
  value:       string
  onChange:    (value: string) => void
  onSelect:    (result: AddressSuggestion) => void
  id?:         string
  placeholder?: string
}

export function AddressAutocomplete({ value, onChange, onSelect, id, placeholder }: Props) {
  const [suggestions, setSuggestions]   = useState<AddressSuggestion[]>([])
  const [loading,     setLoading]       = useState(false)
  const [open,        setOpen]          = useState(false)
  const [activeIndex, setActiveIndex]   = useState(-1)
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef     = useRef<AbortController | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    onChange(val)
    setActiveIndex(-1)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (val.trim().length < 3) {
      setSuggestions([])
      setOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort()
      abortRef.current = new AbortController()
      setLoading(true)
      try {
        const res  = await fetch(`/api/address-search?q=${encodeURIComponent(val)}`, { signal: abortRef.current.signal })
        const data = await res.json()
        setSuggestions(data)
        setOpen(data.length > 0)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, 200)
  }

  async function handleSelect(s: AddressSuggestion) {
    // Cancel any pending debounced search + in-flight request from earlier typing
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    abortRef.current?.abort()

    onChange(s.streetAddress)
    setSuggestions([])
    setOpen(false)
    setActiveIndex(-1)

    // Enrich with lot/section/plan/lga/parish/county via propid lookup
    let enriched: AddressSuggestion = s
    if (s.propid) {
      setLoading(true)
      try {
        const res = await fetch(`/api/property-details?propid=${s.propid}`)
        if (res.ok) {
          const d = await res.json()
          enriched = {
            ...s,
            streetAddress: d.streetAddress ?? s.streetAddress,
            suburb: d.suburb ?? s.suburb,
            postcode: d.postcode ?? s.postcode,
            lot: d.lot ?? null,
            section: d.section ?? null,
            planLabel: d.planLabel ?? null,
            lga: d.lga ?? null,
            parish: d.parish ?? null,
            county: d.county ?? null,
          }
          // Update the visible input if the canonical street address differs
          if (d.streetAddress && d.streetAddress !== s.streetAddress) {
            onChange(d.streetAddress)
          }
        }
      } catch {
        // silently fall back to unenriched
      } finally {
        setLoading(false)
      }
    }

    onSelect(enriched)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      handleSelect(suggestions[activeIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          id={id}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
          placeholder={placeholder ?? 'Start typing an address…'}
          autoComplete="off"
          className="flex h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-9 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 animate-spin" />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={e => { e.preventDefault(); handleSelect(s) }}
              className={`flex items-start gap-2.5 w-full px-3 py-2.5 text-left text-sm transition-colors ${
                i === activeIndex
                  ? 'bg-blue-50 text-blue-900'
                  : 'hover:bg-slate-50 text-slate-700'
              } ${i > 0 ? 'border-t border-slate-100' : ''}`}
            >
              <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
              <div className="leading-snug">
                <span className="font-medium">{s.streetAddress}</span>
                {(s.suburb || s.state || s.postcode) && (
                  <span className="text-slate-500">
                    {' '}{[s.suburb, s.state, s.postcode].filter(Boolean).join(' ')}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
