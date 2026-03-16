import React, { useEffect, useRef } from 'react'

const COLORS = ['#7c6cfc', '#e879f9', '#34d399', '#fbbf24', '#f87171', '#60a5fa', '#f472b6']

export default function Confetti({ active = true }) {
  const canvasRef = useRef(null)
  const particlesRef = useRef([])
  const rafRef = useRef(null)

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    function resize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Spawn particles in bursts
    function spawn(count = 12) {
      for (let i = 0; i < count; i++) {
        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: -10,
          w: Math.random() * 10 + 6,
          h: Math.random() * 6 + 4,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          vx: (Math.random() - 0.5) * 3,
          vy: Math.random() * 3 + 2,
          angle: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 0.2,
          opacity: 1,
          life: 1,
          decay: Math.random() * 0.008 + 0.004,
        })
      }
    }

    // Initial burst
    for (let i = 0; i < 8; i++) spawn(15)

    // Ongoing drizzle
    const spawnInterval = setInterval(() => spawn(6), 300)

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particlesRef.current = particlesRef.current.filter(p => p.life > 0)

      for (const p of particlesRef.current) {
        p.x += p.vx
        p.vy += 0.06 // gravity
        p.y += p.vy
        p.angle += p.spin
        p.life -= p.decay

        ctx.save()
        ctx.globalAlpha = Math.max(0, p.life)
        ctx.translate(p.x, p.y)
        ctx.rotate(p.angle)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      window.removeEventListener('resize', resize)
      clearInterval(spawnInterval)
      cancelAnimationFrame(rafRef.current)
      particlesRef.current = []
    }
  }, [active])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', inset: 0,
        pointerEvents: 'none',
        zIndex: 100,
      }}
    />
  )
}
