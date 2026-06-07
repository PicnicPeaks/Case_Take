import { useState, useEffect } from 'react'
import App from './App.jsx'
import DashboardView from './DashboardView.jsx'
import CaseSummaryView from './CaseSummaryView.jsx'
import FirmSettings from './FirmSettings.jsx'
import AdminView from './AdminView.jsx'
import { getFirm } from './supabase.js'

const NAVY = '#1a2e4a'

function LoadingScreen({ color = NAVY }) {
  return (
    <div style={{
      minHeight: '100svh', background: '#f3f4f6',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif",
    }}>
      <div style={{ textAlign: 'center', color: '#9ca3af' }}>
        <div style={{ fontSize: 30, marginBottom: 10 }}>⚖️</div>
        <div style={{ fontSize: 13 }}>Loading…</div>
      </div>
    </div>
  )
}

function FirmNotFound({ slug }) {
  return (
    <div style={{
      minHeight: '100svh', background: '#f3f4f6',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif",
    }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <div style={{ fontWeight: 700, fontSize: 18, color: '#111827', marginBottom: 8 }}>
          Firm not found
        </div>
        <div style={{ fontSize: 13.5, color: '#6b7280', lineHeight: 1.65 }}>
          No firm with the ID <code style={{ background: '#f3f4f6', borderRadius: 4, padding: '1px 6px' }}>{slug}</code> exists.
          Check your link or contact your account manager.
        </div>
        <a href="/" style={{
          display: 'inline-block', marginTop: 20, background: NAVY, color: 'white',
          borderRadius: 8, padding: '9px 22px', fontSize: 13, fontWeight: 700, textDecoration: 'none',
        }}>Go to CaseTake</a>
      </div>
    </div>
  )
}

export default function Router() {
  const params   = new URLSearchParams(window.location.search)
  const firmSlug = params.get('firm')
  const view     = params.get('view')   // 'dashboard' | 'settings' | null
  const caseId   = params.get('case')

  // Accept both ?view=dashboard and ?dashboard for firm routes
  const wantsDashboard = view === 'dashboard' || params.has('dashboard')
  const wantsSettings  = view === 'settings'  || params.has('settings')

  const [firm,        setFirm]        = useState(null)
  const [firmLoading, setFirmLoading] = useState(!!firmSlug)
  const [firmMissing, setFirmMissing] = useState(false)

  useEffect(() => {
    if (!firmSlug) return
    getFirm(firmSlug)
      .then(data => {
        if (data.error) setFirmMissing(true)
        else            setFirm(data)
      })
      .catch(() => setFirmMissing(true))
      .finally(() => setFirmLoading(false))
  }, [firmSlug])

  // ── Non-firm routes ──────────────────────────────────────────────────────────
  if (!firmSlug) {
    if (params.has('admin'))  return <AdminView />
    if (caseId)               return <CaseSummaryView caseId={caseId} />
    if (wantsDashboard)       return <DashboardView />
    return <App />
  }

  // ── Firm routes ──────────────────────────────────────────────────────────────
  if (firmLoading) return <LoadingScreen />
  if (firmMissing) return <FirmNotFound slug={firmSlug} />

  // Pass firmSlug directly so DashboardView can scope data without waiting for firm object
  if (wantsSettings)  return <FirmSettings firmSlug={firmSlug} />
  if (wantsDashboard) return <DashboardView firm={firm} firmSlug={firmSlug} />
  if (caseId)         return <CaseSummaryView caseId={caseId} firmSlug={firmSlug} />

  // Default: firm-branded intake
  return <App firm={firm} />
}
