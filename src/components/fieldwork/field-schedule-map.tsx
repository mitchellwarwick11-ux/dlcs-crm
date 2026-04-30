'use client'

import { useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { ScheduleEntryFull } from '@/types/database'

// Leaflet's default marker icons don't resolve correctly under bundlers,
// so point them at the unpkg CDN explicitly.
const DefaultIcon = L.icon({
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize:    [25, 41],
  iconAnchor:  [12, 41],
  popupAnchor: [1, -34],
  shadowSize:  [41, 41],
})
L.Marker.prototype.options.icon = DefaultIcon

// Default centre: Delfs Lascelles' patch is northern NSW / SE QLD.
// Grafton area works as a reasonable fallback when nothing has coords.
const DEFAULT_CENTER: [number, number] = [-29.69, 152.93]
const DEFAULT_ZOOM   = 9

interface Pin {
  id: string
  lat: number
  lng: number
  jobNumber: string
  address: string
  suburb: string | null
  date: string
  surveyors: string[]
  hours: number | null
  status: string
}

interface Props {
  entries: ScheduleEntryFull[]
}

export default function FieldScheduleMap({ entries }: Props) {
  const pins = useMemo<Pin[]>(() => {
    const grouped = new Map<string, Pin>()
    for (const e of entries) {
      const p = e.projects
      if (!p?.site_lat || !p?.site_lng) continue
      const key = `${p.id}|${e.date}`
      const existing = grouped.get(key)
      const surveyorNames = e.field_surveyors.map(s => s.full_name)
      if (existing) {
        existing.surveyors = [...new Set([...existing.surveyors, ...surveyorNames])]
        existing.hours = (existing.hours ?? 0) + Number(e.hours ?? 0)
      } else {
        grouped.set(key, {
          id: key,
          lat: p.site_lat,
          lng: p.site_lng,
          jobNumber: p.job_number,
          address: p.site_address ?? '—',
          suburb: p.suburb,
          date: e.date,
          surveyors: surveyorNames,
          hours: Number(e.hours ?? 0),
          status: e.status,
        })
      }
    }
    return Array.from(grouped.values())
  }, [entries])

  const center = useMemo<[number, number]>(() => {
    if (pins.length === 0) return DEFAULT_CENTER
    const avgLat = pins.reduce((s, p) => s + p.lat, 0) / pins.length
    const avgLng = pins.reduce((s, p) => s + p.lng, 0) / pins.length
    return [avgLat, avgLng]
  }, [pins])

  const totalScheduled = entries.length
  const withCoords = pins.length
  const missing = totalScheduled - withCoords

  return (
    <div className="space-y-2">
      <div className="text-xs text-slate-500">
        Showing <span className="font-medium text-slate-700">{withCoords}</span> pinned
        {missing > 0 && (
          <> — <span className="text-amber-700">{missing} entries have no coordinates</span> (address not geocoded)</>
        )}
      </div>
      <div className="rounded-md border border-slate-200 overflow-hidden" style={{ height: 480 }}>
        <MapContainer
          center={center}
          zoom={pins.length > 0 ? 10 : DEFAULT_ZOOM}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {pins.map(pin => (
            <Marker key={pin.id} position={[pin.lat, pin.lng]}>
              <Popup>
                <div className="text-xs space-y-1">
                  <div className="font-semibold text-slate-900">{pin.jobNumber}</div>
                  <div className="text-slate-700">{pin.address}</div>
                  {pin.suburb && <div className="text-slate-500">{pin.suburb}</div>}
                  <div className="pt-1 border-t border-slate-200">
                    <div><span className="text-slate-500">Date:</span> {pin.date}</div>
                    {pin.hours ? <div><span className="text-slate-500">Hours:</span> {pin.hours}</div> : null}
                    {pin.surveyors.length > 0 && (
                      <div><span className="text-slate-500">Crew:</span> {pin.surveyors.join(', ')}</div>
                    )}
                    <div><span className="text-slate-500">Status:</span> {pin.status}</div>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
