import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { useStore } from './store'
import { registerToast } from './hooks/useEntries'
import { useToast, Toast } from './components/Toast'

import LandingPage  from './pages/LandingPage'
import LoginPage    from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AppShell     from './pages/AppShell'
import AdminPage    from './pages/AdminPage'

export default function App() {
  const { initAuth } = useAuth()
  const { isOnline, setIsOnline } = useStore()
  const toast = useToast()

  // Register toast for useEntries hook
  useEffect(() => { registerToast(toast) }, [toast])

  // Init auth on mount
  useEffect(() => { initAuth() }, [])

  // Online/offline
  useEffect(() => {
    const on  = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [setIsOnline])

  return (
    <>
      <div className={'offline-bar' + (isOnline ? '' : ' visible')}>
        ⚡ Offline — entries will sync when connected
      </div>

      <Routes>
        <Route path="/"         element={<LandingPage />} />
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/app"      element={<AppShell />} />
        <Route path="/admin"    element={<AdminPage />} />
        <Route path="*"         element={<Navigate to="/" replace />} />
      </Routes>

      <Toast />
    </>
  )
}
