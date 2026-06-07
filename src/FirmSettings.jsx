import { useState, useEffect } from 'react'
import { getFirm, updateFirm } from './supabase.js'
import { onBrand } from './colorUtils.js'

const NAVY = '#1a2e4a'

export default function FirmSettings({ firmSlug }) {
  const [token,   setToken]   = useState(() => sessionStorage.getItem(`ct_token_${firmSlug}`) ?? '')
  const [firm,    setFirm]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [locked,  setLocked]  = useState(true)

  // form state
  const [name,          setName]          = useState('')
  const [tagline,       setTagline]       = useState('')
  const [logoUrl,       setLogoUrl]       = useState('')
  const [primaryColor,  setPrimaryColor]  = useState('#1a2e4a')
  const [intakeEmails,  setIntakeEmails]  = useState('')   // comma-separated in the input
  const [fromEmail,     setFromEmail]     = useState('')
  const [fromName,      setFromName]      = useState('')
  const [fluentKey,     setFluentKey]     = useState('')
  const [showFluentKey, setShowFluentKey] = useState(false)

  const [saving,   setSaving]   = useState(false)
  const [saveMsg,  setSaveMsg]  = useState(null)   // { type: 'success' | 'error', text }
  const [tokenErr, setTokenErr] = useState('')

  useEffect(() => {
    getFirm(firmSlug)
      .then(data => {
        if (!data.error) {
          setFirm(data)
          setName(data.name ?? '')
          setTagline(data.tagline ?? '')
          setLogoUrl(data.logo_url ?? '')
          setPrimaryColor(data.primary_color ?? '#1a2e4a')
          setIntakeEmails((data.intake_emails ?? []).join(', '))
          setFromEmail(data.from_email ?? '')
          setFromName(data.from_name ?? '')
        }
      })
      .finally(() => setLoading(false))
  }, [firmSlug])

  const BRAND = firm?.primary_color ?? NAVY
  const ON    = onBrand(BRAND)

  const unlock = async () => {
    setTokenErr('')
    if (!token.trim()) { setTokenErr('Enter your settings token to continue.'); return }
    // Verify by attempting a no-op update — if token is wrong we get 403
    const res = await updateFirm(firmSlug, token.trim(), { name: firm?.name ?? name })
    if (res.error === 'Invalid settings token') {
      setTokenErr('Invalid token — check with your CaseTake account manager.')
    } else {
      sessionStorage.setItem(`ct_token_${firmSlug}`, token.trim())
      setLocked(false)
    }
  }

  const save = async () => {
    setSaving(true)
    setSaveMsg(null)
    const fields = {
      name,
      tagline,
      logo_url:      logoUrl      || null,
      primary_color: primaryColor,
      intake_emails: intakeEmails.split(',').map(e => e.trim()).filter(Boolean),
      from_email:    fromEmail    || null,
      from_name:     fromName     || null,
      ...(fluentKey.trim() ? { fluent_case_api_key: fluentKey.trim() } : {}),
    }
    const res = await updateFirm(firmSlug, token.trim(), fields)
    setSaving(false)
    if (res.success) {
      setSaveMsg({ type: 'success', text: 'Settings saved.' })
      setFirm(prev => ({ ...prev, ...fields }))
      setTimeout(() => setSaveMsg(null), 3500)
    } else {
      setSaveMsg({ type: 'error', text: res.error ?? 'Failed to save.' })
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{
        minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f3f4f6', fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif",
      }}>
        <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Loading…</div>
      </div>
    )
  }

  if (!firm) {
    return (
      <div style={{
        minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f3f4f6', fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif",
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>Firm not found</div>
          <div style={{ color: '#6b7280', fontSize: 13, marginTop: 6 }}>
            No firm with slug <code>{firmSlug}</code> exists.
          </div>
        </div>
      </div>
    )
  }

  // ── Token gate ───────────────────────────────────────────────────────────────

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', border: '1.5px solid #e5e7eb',
    borderRadius: 8, padding: '9px 13px', fontSize: 14, fontFamily: 'inherit',
    outline: 'none', color: '#111827', background: 'white',
  }

  const labelStyle = {
    display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6,
  }

  return (
    <div style={{
      minHeight: '100svh', background: '#f3f4f6',
      fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif",
    }}>

      {/* Header */}
      <header style={{
        background: BRAND, height: 58, padding: '0 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {firm.logo_url
            ? <img src={firm.logo_url} alt={firm.name} style={{ height: 32, objectFit: 'contain' }} />
            : <span style={{ fontSize: 20 }}>⚖️</span>}
          <div>
            <div style={{ color: ON.text, fontWeight: 800, fontSize: 15, lineHeight: 1 }}>{firm.name}</div>
            <div style={{ color: ON.textMuted, fontSize: 10.5 }}>Firm Settings</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href={`/?firm=${firmSlug}&view=dashboard`} style={{
            background: ON.btnBg, color: ON.btnText,
            border: `1px solid ${ON.btnBorder}`,
            borderRadius: 7, padding: '6px 14px', fontSize: 12.5,
            fontWeight: 600, textDecoration: 'none',
          }}>Dashboard</a>
          <a href={`/?firm=${firmSlug}`} style={{
            background: ON.btnPrimary, color: ON.btnPrimaryText,
            borderRadius: 7, padding: '6px 14px', fontSize: 12.5,
            fontWeight: 700, textDecoration: 'none',
          }}>Intake Form</a>
          {firm?.has_dashboard_password && (
            <button
              onClick={() => {
                sessionStorage.removeItem(`ct_firm_auth_${firmSlug}`)
                window.location.reload()
              }}
              style={{
                background: ON.btnBg, color: ON.btnText,
                border: `1px solid ${ON.btnBorder}`, borderRadius: 7,
                padding: '6px 13px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >Sign out</button>
          )}
        </div>
      </header>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px 60px' }}>

        {/* Token gate */}
        {locked && (
          <div style={{
            background: 'white', borderRadius: 12, padding: '28px 28px',
            boxShadow: '0 1px 8px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb',
            marginBottom: 24, textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>🔐</div>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#111827', marginBottom: 6 }}>
              Enter your settings token
            </div>
            <div style={{ fontSize: 13.5, color: '#6b7280', marginBottom: 20, lineHeight: 1.6 }}>
              Your settings token was provided when your firm was set up.<br />
              Contact your CaseTake account manager if you need it.
            </div>
            <div style={{ maxWidth: 320, margin: '0 auto' }}>
              <input
                type="password"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={token}
                onChange={e => setToken(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && unlock()}
                style={{ ...inputStyle, textAlign: 'center', letterSpacing: '0.04em', marginBottom: 12 }}
                onFocus={e => (e.target.style.borderColor = BRAND)}
                onBlur={e  => (e.target.style.borderColor = '#e5e7eb')}
              />
              {tokenErr && (
                <div style={{ color: '#dc2626', fontSize: 12.5, marginBottom: 12 }}>{tokenErr}</div>
              )}
              <button
                onClick={unlock}
                style={{
                  width: '100%', background: BRAND, color: 'white', border: 'none',
                  borderRadius: 8, padding: '10px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}
              >Unlock Settings</button>
            </div>
          </div>
        )}

        {/* Settings form */}
        {!locked && (
          <>
            {saveMsg && (
              <div style={{
                background: saveMsg.type === 'success' ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${saveMsg.type === 'success' ? '#86efac' : '#fca5a5'}`,
                borderRadius: 8, padding: '11px 16px', marginBottom: 18,
                fontSize: 13.5, color: saveMsg.type === 'success' ? '#15803d' : '#dc2626',
              }}>
                {saveMsg.type === 'success' ? '✅' : '⚠️'} {saveMsg.text}
              </div>
            )}

            {/* Branding */}
            <Card title="Branding">
              <Field label="Firm Name" required>
                <input value={name} onChange={e => setName(e.target.value)}
                  style={inputStyle} placeholder="Smith & Associates"
                  onFocus={e => (e.target.style.borderColor = BRAND)}
                  onBlur={e  => (e.target.style.borderColor = '#e5e7eb')} />
              </Field>
              <Field label="Tagline" hint="Shown under your firm name">
                <input value={tagline} onChange={e => setTagline(e.target.value)}
                  style={inputStyle} placeholder="California Workers' Compensation"
                  onFocus={e => (e.target.style.borderColor = BRAND)}
                  onBlur={e  => (e.target.style.borderColor = '#e5e7eb')} />
              </Field>
              <Field label="Logo URL" hint="Direct link to your logo image (PNG/SVG recommended)">
                <input value={logoUrl} onChange={e => setLogoUrl(e.target.value)}
                  style={inputStyle} placeholder="https://yourfirm.com/logo.png"
                  onFocus={e => (e.target.style.borderColor = BRAND)}
                  onBlur={e  => (e.target.style.borderColor = '#e5e7eb')} />
                {logoUrl && (
                  <div style={{ marginTop: 10, padding: '10px 14px', background: BRAND, borderRadius: 8, display: 'inline-block' }}>
                    <img src={logoUrl} alt="Logo preview" style={{ height: 34, objectFit: 'contain', display: 'block' }}
                      onError={e => (e.target.style.display = 'none')} />
                  </div>
                )}
              </Field>
              <Field label="Brand Color" hint="Primary color used throughout the interface">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                    style={{ width: 48, height: 38, borderRadius: 7, border: '1.5px solid #e5e7eb', cursor: 'pointer', padding: 3 }} />
                  <input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                    style={{ ...inputStyle, flex: 1, fontFamily: 'monospace' }} placeholder="#1a2e4a"
                    onFocus={e => (e.target.style.borderColor = BRAND)}
                    onBlur={e  => (e.target.style.borderColor = '#e5e7eb')} />
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: primaryColor, border: '1px solid #e5e7eb', flexShrink: 0 }} />
                </div>
              </Field>
            </Card>

            {/* Email Configuration */}
            <Card title="Email Configuration">
              <Field label="Intake notification emails" required
                hint="These addresses receive the full intake report for every new case. Separate multiple addresses with commas.">
                <textarea value={intakeEmails} onChange={e => setIntakeEmails(e.target.value)}
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }}
                  placeholder="attorney@firm.com, paralegal@firm.com"
                  onFocus={e => (e.target.style.borderColor = BRAND)}
                  onBlur={e  => (e.target.style.borderColor = '#e5e7eb')} />
              </Field>
              <Field label="From name" hint="Shown as the sender name in outgoing emails">
                <input value={fromName} onChange={e => setFromName(e.target.value)}
                  style={inputStyle} placeholder="Smith & Associates"
                  onFocus={e => (e.target.style.borderColor = BRAND)}
                  onBlur={e  => (e.target.style.borderColor = '#e5e7eb')} />
              </Field>
              <Field label="From email" hint="Reply-to address for outgoing emails">
                <input value={fromEmail} onChange={e => setFromEmail(e.target.value)}
                  style={inputStyle} type="email" placeholder="intakes@firm.com"
                  onFocus={e => (e.target.style.borderColor = BRAND)}
                  onBlur={e  => (e.target.style.borderColor = '#e5e7eb')} />
              </Field>
            </Card>

            {/* Fluent Case */}
            <Card title="Fluent Case Integration">
              <Field label="Fluent Case API key"
                hint="Used when accepting intakes. Overrides the global key for your firm's matters.">
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type={showFluentKey ? 'text' : 'password'}
                    value={fluentKey}
                    onChange={e => setFluentKey(e.target.value)}
                    style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 12.5 }}
                    placeholder={firm.fluent_case_api_key ? '••••••••  (key saved — enter new to replace)' : 'Paste your Fluent Case API token'}
                    onFocus={e => (e.target.style.borderColor = BRAND)}
                    onBlur={e  => (e.target.style.borderColor = '#e5e7eb')}
                  />
                  <button
                    onClick={() => setShowFluentKey(v => !v)}
                    style={{
                      background: 'none', border: '1.5px solid #e5e7eb', borderRadius: 8,
                      padding: '0 12px', cursor: 'pointer', fontSize: 15, color: '#6b7280',
                    }}
                  >{showFluentKey ? '🙈' : '👁️'}</button>
                </div>
              </Field>
            </Card>

            {/* Save */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                onClick={save}
                disabled={saving}
                style={{
                  background: saving ? '#9ca3af' : BRAND, color: 'white',
                  border: 'none', borderRadius: 9, padding: '12px 36px',
                  fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                  boxShadow: saving ? 'none' : `0 3px 12px ${BRAND}55`,
                }}
              >{saving ? 'Saving…' : 'Save Settings'}</button>
            </div>
          </>
        )}

        {/* Firm URL info */}
        <div style={{
          background: 'white', borderRadius: 12, padding: '18px 22px',
          border: '1px solid #e5e7eb', boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
          marginTop: 28,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Your firm URLs
          </div>
          {[
            ['Intake form',  `https://casetake.picnicpeaks.com/?firm=${firmSlug}`],
            ['Dashboard',    `https://casetake.picnicpeaks.com/?firm=${firmSlug}&view=dashboard`],
            ['Settings',     `https://casetake.picnicpeaks.com/?firm=${firmSlug}&view=settings`],
          ].map(([label, url]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#6b7280', width: 80, flexShrink: 0 }}>{label}</span>
              <code style={{
                flex: 1, fontSize: 11.5, background: '#f8fafc', border: '1px solid #e5e7eb',
                borderRadius: 6, padding: '4px 10px', color: '#374151', wordBreak: 'break-all',
              }}>{url}</code>
              <button
                onClick={() => navigator.clipboard.writeText(url)}
                style={{
                  background: 'none', border: '1px solid #e5e7eb', borderRadius: 6,
                  padding: '3px 9px', fontSize: 11, cursor: 'pointer', color: '#6b7280', flexShrink: 0,
                }}
              >Copy</button>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Card({ title, children }) {
  return (
    <div style={{
      background: 'white', borderRadius: 12, padding: '22px 24px',
      boxShadow: '0 1px 8px rgba(0,0,0,0.07)', border: '1px solid #e5e7eb',
      marginBottom: 18,
    }}>
      <div style={{
        fontWeight: 800, fontSize: 13, color: '#111827',
        borderBottom: '1px solid #f3f4f6', paddingBottom: 12, marginBottom: 18,
        letterSpacing: '-0.1px',
      }}>{title}</div>
      {children}
    </div>
  )
}

function Field({ label, hint, required, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{
        display: 'block', fontSize: 12, fontWeight: 700, color: '#374151',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5,
      }}>
        {label}{required && <span style={{ color: '#dc2626', marginLeft: 3 }}>*</span>}
      </label>
      {hint && <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 7, lineHeight: 1.5 }}>{hint}</div>}
      {children}
    </div>
  )
}
