'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Loader2, MapPin, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

export interface AddressPick {
  streetAddress: string
  suburb:        string
  postcode:      string | null
  state:         string | null
  council:       string | null
  lot:           string | null
  section:       string | null
  plan:          string | null
  lga:           string | null
  parish:        string | null
  county:        string | null
  lat:           number | null
  lng:           number | null
}

interface Suggestion {
  placeId:       string
  label:         string
  mainText:      string
  secondaryText: string
}

interface Props {
  id?:          string
  value:        string
  onChange:     (val: string) => void
  onSelect:     (pick: AddressPick) => void
  placeholder?: string
  /** Extra classes appended to the inner Input (use for per-page background/styling). */
  inputClassName?: string
  onLotLookupStart?: () => void
  onLotLookupEnd?:   () => void
}

// Google Places session token: one UUID per autocomplete session (typing → selection)
// Billed as a single session rather than per-keystroke.
function newSessionToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function AddressAutocomplete({ id, value, onChange, onSelect, placeholder, inputClassName, onLotLookupStart, onLotLookupEnd }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen]               = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [activeIdx, setActiveIdx]     = useState(-1)
  const [resolving, setResolving]     = useState(false)

  const latestQueryRef = useRef<string>('')
  const abortRef       = useRef<AbortController | null>(null)
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef     = useRef<HTMLDivElement>(null)
  const sessionRef     = useRef<string>(newSessionToken())

  const runSearch = useCallback(async (q: string) => {
    latestQueryRef.current = q

    if (q.trim().length < 3) {
      setSuggestions([])
      setOpen(false)
      setLoading(false)
      setError(null)
      return
    }

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/address/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: q, sessionToken: sessionRef.current }),
        signal: ctrl.signal,
      })
      const data = await res.json()

      if (latestQueryRef.current !== q) return

      if (data.error) {
        setError('Address lookup unavailable. Type the address manually.')
        setSuggestions([])
      } else {
        setSuggestions(data.suggestions ?? [])
        setError(null)
      }
      setOpen(true)
      setActiveIdx(-1)
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      if (latestQueryRef.current !== q) return
      setError('Address lookup failed. Type the address manually.')
      setSuggestions([])
      setOpen(true)
    } finally {
      if (latestQueryRef.current === q) setLoading(false)
    }
  }, [])

  function handleInput(val: string) {
    onChange(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(val), 250)
  }

  async function pick(s: Suggestion) {
    // Show chosen label immediately
    onChange(s.mainText || s.label)
    setOpen(false)
    setSuggestions([])
    setResolving(true)

    try {
      const res = await fetch('/api/address/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId: s.placeId, sessionToken: sessionRef.current }),
      })
      const data = await res.json()

      // New session for the next autocomplete interaction
      sessionRef.current = newSessionToken()

      if (data.error) {
        setError('Could not resolve address details. Fields filled from suggestion only.')
        onSelect({
          streetAddress: s.mainText,
          suburb:        '',
          postcode:      null,
          state:         null,
          council:       null,
          lot:           null,
          section:       null,
          plan:          null,
          lga:           null,
          parish:        null,
          county:        null,
          lat:           null,
          lng:           null,
        })
        return
      }

      onChange(data.streetAddress || s.mainText)
      onSelect({
        streetAddress: data.streetAddress || s.mainText,
        suburb:        data.suburb || '',
        postcode:      data.postcode,
        state:         data.state,
        council:       data.council,
        lot:           null,
        section:       null,
        plan:          null,
        lga:           data.lga,
        parish:        data.parish,
        county:        data.county,
        lat:           data.lat ?? null,
        lng:           data.lng ?? null,
      })

      // Background lot lookup — NSW address layer is slow (5-15s) but authoritative.
      // Fires only for NSW addresses with a street number and road name.
      if (data.state === 'New South Wales' && data.streetNumber && data.roadName && data.suburb) {
        onLotLookupStart?.()
        fetch('/api/address/lot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            housenumber: data.streetNumber,
            roadname:    data.roadName,
            suburb:      data.suburb,
          }),
        })
          .then(r => r.json())
          .then(lot => {
            if (lot && (lot.lot || lot.section || lot.plan)) {
              onSelect({
                streetAddress: data.streetAddress || s.mainText,
                suburb:        data.suburb || '',
                postcode:      data.postcode,
                state:         data.state,
                council:       data.council,
                lot:           lot.lot,
                section:       lot.section,
                plan:          lot.plan,
                lga:           data.lga,
                parish:        data.parish,
                county:        data.county,
                lat:           data.lat ?? null,
                lng:           data.lng ?? null,
              })
            }
          })
          .catch(() => { /* silent — user can fill manually */ })
          .finally(() => { onLotLookupEnd?.() })
      }
    } catch {
      setError('Could not resolve address details. Fields filled from suggestion only.')
      onSelect({
        streetAddress: s.mainText,
        suburb:        '',
        postcode:      null,
        state:         null,
        council:       null,
        lot:           null,
        section:       null,
        plan:          null,
        lga:           null,
        parish:        null,
        county:        null,
        lat:           null,
        lng:           null,
      })
    } finally {
      setResolving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      if (activeIdx >= 0) {
        e.preventDefault()
        pick(suggestions[activeIdx])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const showDropdown = open && (loading || error || suggestions.length > 0 || value.trim().length >= 3)

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <Input
          id={id}
          value={value}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0 || value.trim().length >= 3) setOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? 'Start typing an address…'}
          className={`pl-9 pr-9${inputClassName ? ` ${inputClassName}` : ''}`}
          autoComplete="off"
        />
        {(loading || resolving) && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 animate-spin" />
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg overflow-hidden">
          {error ? (
            <div className="px-3 py-3 text-sm text-red-600">{error}</div>
          ) : loading && suggestions.length === 0 ? (
            <div className="px-3 py-3 text-sm text-slate-500 flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Searching…
            </div>
          ) : suggestions.length === 0 ? (
            <div className="px-3 py-3 text-sm text-slate-500">
              No matches — keep typing or enter the address manually.
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {suggestions.map((s, i) => (
                <li key={s.placeId}>
                  <button
                    type="button"
                    onMouseDown={e => { e.preventDefault(); pick(s) }}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={`w-full text-left px-3 py-2 flex items-start gap-2.5 transition-colors ${
                      activeIdx === i ? 'bg-slate-100' : 'hover:bg-slate-50'
                    }`}
                  >
                    <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{s.mainText}</p>
                      {s.secondaryText && <p className="text-xs text-slate-500 truncate">{s.secondaryText}</p>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
