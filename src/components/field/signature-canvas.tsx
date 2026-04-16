'use client'

import { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react'

export interface SignatureCanvasHandle {
  isEmpty: () => boolean
  toDataURL: () => string
  clear: () => void
}

interface Props {
  className?: string
  onDraw?: () => void
}

export const SignatureCanvas = forwardRef<SignatureCanvasHandle, Props>(
  function SignatureCanvas({ className = '', onDraw }, ref) {
    const canvasRef  = useRef<HTMLCanvasElement>(null)
    const drawing    = useRef(false)
    const lastPos    = useRef({ x: 0, y: 0 })
    const hasStrokes = useRef(false)
    const [ready, setReady] = useState(false)

    // Initialise canvas size + context settings
    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0) return

      const dpr = window.devicePixelRatio || 1
      canvas.width  = rect.width  * dpr
      canvas.height = rect.height * dpr

      const ctx = canvas.getContext('2d')!
      ctx.scale(dpr, dpr)
      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth   = 2.5
      ctx.lineCap     = 'round'
      ctx.lineJoin    = 'round'
      setReady(true)
    }, [])

    function getPos(e: { clientX: number; clientY: number }) {
      const canvas = canvasRef.current!
      const rect   = canvas.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    function startDraw(x: number, y: number) {
      drawing.current  = true
      lastPos.current  = { x, y }
    }

    function continueDraw(x: number, y: number) {
      if (!drawing.current) return
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')!
      ctx.beginPath()
      ctx.moveTo(lastPos.current.x, lastPos.current.y)
      ctx.lineTo(x, y)
      ctx.stroke()
      lastPos.current = { x, y }
      if (!hasStrokes.current) {
        hasStrokes.current = true
        onDraw?.()
      }
    }

    function endDraw() { drawing.current = false }

    useImperativeHandle(ref, () => ({
      isEmpty:   () => !hasStrokes.current,
      toDataURL: () => canvasRef.current?.toDataURL('image/png') ?? '',
      clear: () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')!
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        hasStrokes.current = false
      },
    }))

    return (
      <canvas
        ref={canvasRef}
        className={`touch-none cursor-crosshair ${className}`}
        style={{ opacity: ready ? 1 : 0 }}
        onMouseDown={e  => { const p = getPos(e);          startDraw(p.x, p.y) }}
        onMouseMove={e  => { const p = getPos(e);          continueDraw(p.x, p.y) }}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={e => { e.preventDefault(); const p = getPos(e.touches[0]); startDraw(p.x, p.y) }}
        onTouchMove={e  => { e.preventDefault(); const p = getPos(e.touches[0]); continueDraw(p.x, p.y) }}
        onTouchEnd={endDraw}
      />
    )
  }
)
