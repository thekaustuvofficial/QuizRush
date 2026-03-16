import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const nav = useNavigate()
  return (
    <div className="grain page" style={{ textAlign: 'center' }}>
      <h1 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 72, opacity: 0.15, lineHeight: 1 }}>404</h1>
      <p style={{ color: 'var(--text2)', marginBottom: '2rem', marginTop: '0.5rem' }}>Page not found.</p>
      <button className="btn btn-primary" onClick={() => nav('/')}>Go Home</button>
    </div>
  )
}
