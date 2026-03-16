import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Monitors the Supabase Realtime WebSocket connection.
// Shows a non-blocking banner if disconnected, auto-hides when restored.
// Critical for D-day: a network blip on college wifi WILL happen.

export default function ConnectionGuard({ gameId }) {
  const [status, setStatus] = useState('connected') // connected | reconnecting | disconnected
  const [visible, setVisible] = useState(false)
  const timeoutRef = useRef(null)
  const reconnectCountRef = useRef(0)

  useEffect(() => {
    // Monitor the presence channel for connection health
    const channel = supabase.channel(`heartbeat:${gameId}`)

    channel
      .on('system', {}, (payload) => {
        if (payload.extension === 'postgres_changes' && payload.status === 'ok') {
          handleConnected()
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          handleConnected()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          handleDisconnected()
        } else if (status === 'CLOSED') {
          handleDisconnected()
        }
      })

    // Periodic ping every 20s — if Supabase doesn't respond, flag it
    const pingInterval = setInterval(async () => {
      try {
        const { error } = await supabase.from('games').select('id').eq('id', gameId).limit(1).single()
        if (!error) handleConnected()
        else handleDisconnected()
      } catch {
        handleDisconnected()
      }
    }, 20000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(pingInterval)
      clearTimeout(timeoutRef.current)
    }
  }, [gameId])

  function handleConnected() {
    reconnectCountRef.current = 0
    setStatus('connected')
    // Keep banner visible for 2s so player sees "Reconnected" before it hides
    if (visible) {
      timeoutRef.current = setTimeout(() => setVisible(false), 2000)
    }
  }

  function handleDisconnected() {
    reconnectCountRef.current += 1
    setStatus(reconnectCountRef.current <= 2 ? 'reconnecting' : 'disconnected')
    setVisible(true)
    clearTimeout(timeoutRef.current)
  }

  if (!visible) return null

  const isReconnecting = status === 'reconnecting'
  const bgColor = status === 'connected'
    ? 'rgba(52,211,153,0.15)'
    : isReconnecting
      ? 'rgba(251,191,36,0.15)'
      : 'rgba(248,113,113,0.15)'
  const borderColor = status === 'connected'
    ? 'rgba(52,211,153,0.4)'
    : isReconnecting
      ? 'rgba(251,191,36,0.4)'
      : 'rgba(248,113,113,0.4)'
  const textColor = status === 'connected'
    ? 'var(--green)'
    : isReconnecting
      ? 'var(--amber)'
      : 'var(--red)'

  const message = status === 'connected'
    ? '✓ Reconnected'
    : isReconnecting
      ? '⟳ Reconnecting...'
      : '⚠ Connection lost — your answer is saved, waiting to reconnect'

  return (
    <div style={{
      position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, maxWidth: 420, width: 'calc(100% - 2rem)',
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: 'var(--radius-sm)',
      padding: '10px 16px',
      color: textColor,
      fontSize: 13,
      fontWeight: 500,
      textAlign: 'center',
      animation: 'fadeIn 0.3s ease',
      backdropFilter: 'blur(8px)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    }}>
      {message}
    </div>
  )
}
