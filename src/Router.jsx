import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, Outlet, useParams, useOutletContext } from 'react-router-dom'
import App from './App.jsx'
import DashboardView from './DashboardView.jsx'
import CaseSummaryView from './CaseSummaryView.jsx'
import FirmSettings from './FirmSettings.jsx'
import AdminView from './AdminView.jsx'
import FirmAuthGate from './FirmAuthGate.jsx'
import MarketingPage from './MarketingPage.jsx'
import SIBTFView from './SIBTFView.jsx'
import { getFirm } from './supabase.js'

const NAVY = '#1a2e4a'

function LoadingScreen() {
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

// ── Firm loader — resolves :slug, passes firm down via Outlet context ──────────

function FirmLoader() {
  const { slug } = useParams()
  const [firm,    setFirm]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    setFirm(null)
    setLoading(true)
    setMissing(false)
    getFirm(slug)
      .then(data => {
        if (data.error) setMissing(true)
        else            setFirm(data)
      })
      .catch(() => setMissing(true))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return <LoadingScreen />
  if (missing) return <FirmNotFound slug={slug} />
  return <Outlet context={{ firm, slug }} />
}

// ── Firm child routes — consume outlet context ─────────────────────────────────

function FirmIntake() {
  const { firm } = useOutletContext()
  return <App firm={firm} />
}

function FirmDashboard() {
  const { firm, slug } = useOutletContext()
  return <FirmAuthGate firm={firm} firmSlug={slug}><DashboardView firm={firm} firmSlug={slug} /></FirmAuthGate>
}

function FirmSettingsRoute() {
  const { firm, slug } = useOutletContext()
  return <FirmAuthGate firm={firm} firmSlug={slug}><FirmSettings firmSlug={slug} /></FirmAuthGate>
}

function FirmCase() {
  const { firm, slug } = useOutletContext()
  const { id } = useParams()
  return <FirmAuthGate firm={firm} firmSlug={slug}><CaseSummaryView caseId={id} firmSlug={slug} firm={firm} /></FirmAuthGate>
}

function FirmSIBTF() {
  const { firm } = useOutletContext()
  return <SIBTFView firm={firm} />
}

// ── Root router ────────────────────────────────────────────────────────────────

export default function Router() {
  return (
    <Routes>
      <Route path="/"      element={<MarketingPage />} />
      <Route path="/admin" element={<AdminView />} />
      <Route path="/demo"  element={<App demo={true} />} />
      <Route path="/case/:id" element={<StandaloneCaseRoute />} />

      <Route path="/firm/:slug" element={<FirmLoader />}>
        <Route index          element={<FirmIntake />} />
        <Route path="dashboard" element={<FirmDashboard />} />
        <Route path="settings"  element={<FirmSettingsRoute />} />
        <Route path="sibtf"     element={<FirmSIBTF />} />
        <Route path="case/:id"  element={<FirmCase />} />
      </Route>

      {/* Catch-all → home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function StandaloneCaseRoute() {
  const { id } = useParams()
  return <CaseSummaryView caseId={id} />
}
