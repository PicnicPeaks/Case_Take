import { useState } from 'react'
import { verifyFirmPassword } from './supabase.js'
import { onBrand } from './colorUtils.js'

const NAVY = '#1a2e4a'

function storageKey(slug) {
  return `ct_firm_auth_${slug}`
}

export default function FirmAuthGate({ firm, firmSlug, children }) {
  const slug  = firmSlug ?? firm?.slug
  const BRAND = firm?.primary_color ?? NAVY
  const ON    = onBrand(BRAND)

  // Already authenticated this session?
  const [authed,   setAuthed]   = useState(() => !!localStorage.getItem(storageKey(slug)))
  const [password, setPassword] = useState('')
  const [busy,     setBusy]     = useState(false)
  const [error,    setError]    = useState('')

  // If firm has no password, pass straight through
  if (!firm?.has_dashboard_password) return children

  if (authed) return children

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setError('')
    if (!password.trim()) { setError('Enter the password.'); return }
    setBusy(true)
    const res = await verifyFirmPassword(slug, password.trim())
    setBusy(false)
    if (res.success) {
      localStorage.setItem(storageKey(slug), password.trim())
      setAuthed(true)
    } else {
      setError('Incorrect password.')
      setPassword('')
    }
  }

  return (
    <div style={{
      minHeight: '100svh', background: '#f3f4f6',
      display: 'flex', flexDirection: 'column',
      fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif",
    }}>
      {/* Firm header strip */}
      <div style={{
        background: BRAND, height: 52,
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 10,
        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
      }}>
        {firm?.logo_url
          ? <img src={firm.logo_url} alt={firm.name} style={{ maxHeight: 30, maxWidth: 130, objectFit: 'contain' }} />
          : <>
              <span style={{ fontSize: 18 }}>⚖️</span>
              <span style={{ color: ON.text, fontWeight: 800, fontSize: 14 }}>{firm?.name ?? 'CaseTake'}</span>
            </>
        }
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, background: 'white', borderRadius: 20, padding: '3px 9px 3px 7px' }}>
          <span style={{ fontSize: 11 }}>⚖️</span>
          <span style={{ color: NAVY, fontSize: 10, fontWeight: 700 }}>Powered by CaseTake</span>
        </div>
      </div>

      {/* Lock card */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{
          background: 'white', borderRadius: 16, padding: '40px 36px',
          boxShadow: '0 4px 28px rgba(0,0,0,0.10)', width: '100%', maxWidth: 360,
          textAlign: 'center',
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, background: BRAND,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, margin: '0 auto 18px',
          }}>🔒</div>
          <div style={{ fontWeight: 900, fontSize: 19, color: '#111827', marginBottom: 6 }}>
            {firm?.name ?? 'Firm'} Dashboard
          </div>
          <div style={{ fontSize: 13.5, color: '#6b7280', marginBottom: 28, lineHeight: 1.6 }}>
            This dashboard is password protected.
          </div>
          <form onSubmit={handleSubmit}>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box',
                border: `1.5px solid ${error ? '#fca5a5' : '#e5e7eb'}`,
                borderRadius: 9, padding: '10px 14px', fontSize: 14,
                fontFamily: 'inherit', outline: 'none', color: '#111827',
                marginBottom: 10, textAlign: 'center',
                transition: 'border-color 0.15s',
              }}
              onFocus={e  => (e.target.style.borderColor = BRAND)}
              onBlur={e   => (e.target.style.borderColor = error ? '#fca5a5' : '#e5e7eb')}
            />
            {error && (
              <div style={{ color: '#dc2626', fontSize: 12.5, marginBottom: 10 }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={busy}
              style={{
                width: '100%', background: busy ? '#9ca3af' : BRAND,
                color: 'white', border: 'none', borderRadius: 9,
                padding: '11px 0', fontSize: 14, fontWeight: 700,
                cursor: busy ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
            >{busy ? 'Checking…' : 'Unlock'}</button>
          </form>
        </div>
      </div>
    </div>
  )
}
