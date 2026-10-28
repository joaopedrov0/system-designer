import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useView } from '../../store/view'

/** Quanto tempo (ms) cada ponto do traço fica visível antes de sumir. */
const LIFETIME = 1400

interface Point {
  x: number
  y: number
  t: number
}

interface Stroke {
  id: number
  points: Point[]
}

/**
 * Modo laser: desenho temporário por cima do canvas, como um laser pointer. O traço
 * esvanece a partir da cauda e some sozinho; nada é salvo no cenário.
 */
export default function LaserOverlay() {
  const active = useView((s) => s.laser)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [now, setNow] = useState(0)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const drawing = useRef<number | null>(null)
  const nextId = useRef(0)

  // Enquanto houver traço visível, anima o esmaecimento e descarta pontos expirados.
  const hasPoints = strokes.length > 0
  useEffect(() => {
    if (!hasPoints) return
    let frame = requestAnimationFrame(function tick(t) {
      setNow(t)
      setStrokes((prev) =>
        prev
          .map((s) => ({ ...s, points: s.points.filter((p) => t - p.t < LIFETIME) }))
          .filter((s) => s.points.length > 0 || s.id === drawing.current),
      )
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [hasPoints])

  if (!active) return null

  const pointAt = (e: PointerEvent<HTMLDivElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, t: e.timeStamp }
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const id = nextId.current++
    drawing.current = id
    // Calcula já: o updater roda depois do handler, quando currentTarget é null.
    const p = pointAt(e)
    setStrokes((prev) => [...prev, { id, points: [p] }])
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = pointAt(e)
    setCursor(p)
    const id = drawing.current
    if (id === null) return
    setStrokes((prev) => {
      const exists = prev.some((s) => s.id === id)
      return exists
        ? prev.map((s) => (s.id === id ? { ...s, points: [...s.points, p] } : s))
        : [...prev, { id, points: [p] }]
    })
  }
  const onPointerUp = () => {
    drawing.current = null
  }

  return (
    <div
      className="absolute inset-0 z-10 cursor-none touch-none"
      data-testid="laser-overlay"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => setCursor(null)}
    >
      <svg className="laser-glow pointer-events-none absolute inset-0 h-full w-full">
        {strokes.map((s) =>
          s.points.slice(1).map((p, i) => {
            const prev = s.points[i]
            const life = Math.min(1, Math.max(0, 1 - (now - p.t) / LIFETIME))
            return (
              <line
                key={`${s.id}-${i}`}
                x1={prev.x}
                y1={prev.y}
                x2={p.x}
                y2={p.y}
                stroke="#ef4444"
                strokeWidth={2 + 3 * life}
                strokeLinecap="round"
                opacity={life}
              />
            )
          }),
        )}
        {cursor && <circle cx={cursor.x} cy={cursor.y} r={5} fill="#ef4444" />}
      </svg>
    </div>
  )
}
