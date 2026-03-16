import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Home from './pages/Home'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import CreateGame from './pages/CreateGame'
import HostLobby from './pages/HostLobby'
import HostGame from './pages/HostGame'
import Join from './pages/Join'
import PlayerGame from './pages/PlayerGame'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/create" element={<CreateGame />} />
        <Route path="/host/:gameId" element={<HostLobby />} />
        <Route path="/host/:gameId/play" element={<HostGame />} />
        <Route path="/join" element={<Join />} />
        <Route path="/play/:gameId" element={<PlayerGame />} />
        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" />} />
      </Routes>
    </AuthProvider>
  )
}
