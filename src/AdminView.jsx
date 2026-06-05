import { useState, useEffect } from 'react'
import { adminListFirms, adminCreateFirm, adminUpdateFirm, adminDeleteFirm } from './supabase.js'

const NAVY = '#1a2e4a'

const BASE_URL = 'https://casetake.picnicpeaks.com'

export default function AdminView() {
  const [token,    setToken]    = useState(() => sessionStorage.getItem('ct_admin_token') ?? '')
  const [authed,   setAuthed]   = useState(false)
  const [tokenErr, setTokenErr] = useState('')

  const [firms,    setFirms]    = useState([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [creating,   setCreating]   = useState(false)
  const [createErr,  setCreateErr]  = useState('')
  const [form, setForm] = useState({
    slug: '', name: '', tagline: '', logo_url: '',
    primary_color: '#1a2e4a', intake_emails: '',
    from_email: '', from_name: '',
  })

  // Edit form
  const [editingSlug, setEditingSlug] = useState(null)
  const [editForm,    setEditForm]    = useState({})
  const [saving,      setSaving]      = useState(false)
  const [saveErr,     setSaveErr]     = useState('')

  const loadFirms = async (tok) => {
    setLoading(true)
    setError(null)
    const data = await adminListFirms(tok)
    setLoading(false)
    if (Array.isArray(data)) {
      setFirms(data)
    } else {
      setError(data.error ?? 'Failed to load firms')
      if (data.error === 'Invalid admin token') {
        setAuthed(false)
        sessionStorage.removeItem('ct_admin_token')
      }
    }
  }

  const login = async () => {
    setTokenErr('')
    if (!token.trim()) { setTokenErr('Enter the admin token.'); return }
    setLoading(true)
    const data = await adminListFirms(token.trim())
    setLoading(false)
    if (data.error) {
      setTokenErr('Invalid token.')
    } else {
      sessionStorage.setItem('ct_admin_token', token.trim())
      setAuthed(true)
      setFirms(Array.isArray(data) ? data : [])
    }
  }

  useEffect(() => {
    const saved = sessionStorage.getItem('ct_admin_token')
    if (saved) {
      setToken(saved)
      adminListFirms(saved).then(data => {
        if (Array.isArray(data)) { setAuthed(true); setFirms(data) }
        else sessionStorage.removeItem('ct_admin_token')
      })
    }
  }, [])

  const handleCreate = async () => {
    setCreateErr('')
    if (!form.slug || !form.name) { setCreateErr('Slug and name are required.'); return }
    setCreating(true)
    const payload = {
      ...form,
      intake_emails: form.intake_emails.split(',').map(e => e.trim()).filter(Boolean),
    }
    const res = await adminCreateFirm(token, payload)
    setCreating(false)
    if (res.success) {
      setShowCreate(false)
      setForm({ slug: '', name: '', tagline: '', logo_url: '', primary_color: '#1a2e4a', intake_emails: '', from_email: '', from_name: '' })
      loadFirms(token)
    } else {
      setCreateErr(res.error ?? 'Failed to create firm.')
    }
  }

  const startEdit = (firm) => {
    setEditingSlug(firm.slug)
    setSaveErr('')
    setEditForm({
      name:          firm.name          ?? '',
      tagline:       firm.tagline       ?? '',
      logo_url:      firm.logo_url      ?? '',
      primary_color: firm.primary_color ?? '#1a2e4a',
      intake_emails: (firm.intake_emails ?? []).join(', '),
      from_email:    firm.from_email    ?? '',
      from_name:     firm.from_name     ?? '',
    })
  }

  const handleSaveEdit = async () => {
    setSaving(true)
    setSaveErr('')
    const fields = {
      ...editForm,
      intake_emails: editForm.intake_emails.split(',').map(e => e.trim()).filter(Boolean),
    }
    const res = await adminUpdateFirm(token, editingSlug, fields)
    setSaving(false)
    if (res.success) {
      setEditingSlug(null)
      loadFirms(token)
    } else {
      setSaveErr(res.error ?? 'Failed to save.')
    }
  }

  const handleDelete = async (slug) => {
    if (!window.confirm(`Delete firm "${slug}"? This cannot be undone.`)) return
    await adminDeleteFirm(token, slug)
    if (editingSlug === slug) setEditingSlug(null)
    loadFirms(token)
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', border: '1.5px solid #e5e7eb',
    borderRadius: 8, padding: '8px 12px', fontSize: 13.5, fontFamily: 'inherit',
    outline: 'none', color: '#111827',
  }

  // ── Auth gate ──────────────────────────────────────────────────────────────

  if (!authed) {
    return (
      <div style={{
        minHeight: '100svh', background: '#f3f4f6',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif",
      }}>
        <div style={{
          background: 'white', borderRadius: 14, padding: '36px 36px',
          boxShadow: '0 4px 28px rgba(0,0,0,0.12)', width: '100%', maxWidth: 380, textAlign: 'center',
        }}>
          <div style={{ fontSize: 36, marginBottom: 14 }}>🛡️</div>
          <div style={{ fontWeight: 900, fontSize: 20, color: NAVY, marginBottom: 6 }}>CaseTake Admin</div>
          <div style={{ fontSize: 13.5, color: '#6b7280', marginBottom: 24, lineHeight: 1.6 }}>
            Enter your admin token to manage firm accounts.
          </div>
          <input
            type="password" placeholder="Admin token"
            value={token} onChange={e => setToken(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            style={{ ...inputStyle, marginBottom: 10, textAlign: 'center' }}
            onFocus={e => (e.target.style.borderColor = NAVY)}
            onBlur={e  => (e.target.style.borderColor = '#e5e7eb')}
          />
          {tokenErr && <div style={{ color: '#dc2626', fontSize: 12.5, marginBottom: 10 }}>{tokenErr}</div>}
          <button onClick={login} disabled={loading} style={{
            width: '100%', background: NAVY, color: 'white', border: 'none',
            borderRadius: 9, padding: '11px 0', fontSize: 14, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
          }}>
            {loading ? 'Checking…' : 'Sign In'}
          </button>
        </div>
      </div>
    )
  }

  // ── Admin dashboard ────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100svh', background: '#f3f4f6',
      fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif",
    }}>

      {/* Header */}
      <header style={{
        background: NAVY, height: 58, padding: '0 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>⚖️</span>
          <div>
            <div style={{ color: 'white', fontWeight: 800, fontSize: 15, lineHeight: 1 }}>CaseTake</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10.5 }}>Admin — Firm Management</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>{firms.length} firms</span>
          <button
            onClick={() => { sessionStorage.removeItem('ct_admin_token'); setAuthed(false) }}
            style={{
              background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(255,255,255,0.2)', borderRadius: 7,
              padding: '5px 12px', fontSize: 12, cursor: 'pointer',
            }}
          >Sign out</button>
        </div>
      </header>

      <div style={{ padding: '28px 24px 60px' }}>

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
            padding: '12px 16px', marginBottom: 18, fontSize: 13, color: '#dc2626',
          }}>⚠️ {error}</div>
        )}

        {/* Firms table */}
        <div style={{
          background: 'white', borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 1px 8px rgba(0,0,0,0.07)', border: '1px solid #e5e7eb',
          marginBottom: 18,
        }}>
          <div style={{
            padding: '16px 22px', borderBottom: '1px solid #f0f0f0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#111827' }}>
              Registered Firms
            </div>
            <button
              onClick={() => setShowCreate(v => !v)}
              style={{
                background: NAVY, color: 'white', border: 'none', borderRadius: 8,
                padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >{showCreate ? '✕ Cancel' : '+ New Firm'}</button>
          </div>

          {/* Create form */}
          {showCreate && (
            <div style={{
              padding: '22px 24px', borderBottom: '1px solid #f0f0f0',
              background: '#fafbfc',
            }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 14 }}>Create new firm</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                {[
                  ['slug',          'Slug *',        'smithlaw'],
                  ['name',          'Firm Name *',   'Smith & Associates'],
                  ['tagline',       'Tagline',       "California Workers' Compensation"],
                  ['primary_color', 'Brand Color',   '#1a2e4a'],
                  ['logo_url',      'Logo URL',      'https://...'],
                  ['intake_emails', 'Notification Emails', 'atty@firm.com, para@firm.com'],
                  ['from_email',    'From Email',    'intakes@firm.com'],
                  ['from_name',     'From Name',     'Smith & Associates'],
                ].map(([key, label, ph]) => (
                  <div key={key}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                      {label}
                    </label>
                    <input
                      value={form[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={ph}
                      style={{ ...inputStyle, fontSize: 13 }}
                      onFocus={e => (e.target.style.borderColor = NAVY)}
                      onBlur={e  => (e.target.style.borderColor = '#e5e7eb')}
                    />
                  </div>
                ))}
              </div>
              {createErr && <div style={{ color: '#dc2626', fontSize: 12.5, marginBottom: 10 }}>⚠️ {createErr}</div>}
              <button
                onClick={handleCreate}
                disabled={creating}
                style={{
                  background: '#16a34a', color: 'white', border: 'none', borderRadius: 8,
                  padding: '9px 24px', fontSize: 13, fontWeight: 700,
                  cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.6 : 1,
                }}
              >{creating ? 'Creating…' : 'Create Firm'}</button>
            </div>
          )}

          {/* Table */}
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Loading…</div>
          ) : firms.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              No firms yet. Create one above.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '2px solid #f0f0f0' }}>
                  {['Firm', 'Slug', 'Emails', 'Color', 'Created', 'Actions'].map(h => (
                    <th key={h} style={{
                      padding: '10px 16px', textAlign: 'left',
                      fontSize: 10.5, fontWeight: 700, color: '#9ca3af',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {firms.map((firm, i) => {
                  const isEditing = editingSlug === firm.slug
                  return (
                    <>
                      <tr key={firm.id} style={{ borderBottom: isEditing ? 'none' : '1px solid #f3f4f6', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            {firm.logo_url
                              ? <img src={firm.logo_url} alt="" style={{ height: 24, objectFit: 'contain' }} />
                              : <div style={{ width: 24, height: 24, borderRadius: 4, background: firm.primary_color ?? NAVY }} />
                            }
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13.5, color: '#111827' }}>{firm.name}</div>
                              {firm.tagline && <div style={{ fontSize: 11, color: '#9ca3af' }}>{firm.tagline}</div>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <code style={{ fontSize: 12, background: '#f3f4f6', borderRadius: 5, padding: '2px 7px', color: '#374151' }}>
                            {firm.slug}
                          </code>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>
                            {firm.intake_emails?.length
                              ? firm.intake_emails.slice(0, 2).join(', ') + (firm.intake_emails.length > 2 ? ` +${firm.intake_emails.length - 2}` : '')
                              : <span style={{ color: '#d1d5db' }}>—</span>
                            }
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <div style={{ width: 18, height: 18, borderRadius: 4, background: firm.primary_color ?? NAVY, border: '1px solid #e5e7eb' }} />
                            <code style={{ fontSize: 11, color: '#6b7280' }}>{firm.primary_color ?? NAVY}</code>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                          {new Date(firm.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <a href={`/?firm=${firm.slug}`} target="_blank" rel="noreferrer"
                              style={linkBtn('#eff6ff', '#1d4ed8')}>Intake</a>
                            <a href={`/?firm=${firm.slug}&view=dashboard`} target="_blank" rel="noreferrer"
                              style={linkBtn('#f0fdf4', '#15803d')}>Dashboard</a>
                            <button
                              onClick={() => isEditing ? setEditingSlug(null) : startEdit(firm)}
                              style={linkBtn(isEditing ? '#f3f4f6' : '#f0f4ff', isEditing ? '#6b7280' : '#4f46e5')}
                            >{isEditing ? 'Cancel' : 'Edit'}</button>
                            <button
                              onClick={() => { navigator.clipboard.writeText(firm.settings_token); alert('Settings token copied!') }}
                              style={linkBtn('#fefce8', '#a16207')}
                            >Copy Token</button>
                            <button
                              onClick={() => handleDelete(firm.slug)}
                              style={linkBtn('#fef2f2', '#dc2626')}
                            >Delete</button>
                          </div>
                        </td>
                      </tr>

                      {/* ── Inline edit panel ── */}
                      {isEditing && (
                        <tr key={`${firm.id}-edit`}>
                          <td colSpan={6} style={{ padding: 0, borderBottom: '1px solid #f3f4f6' }}>
                            <div style={{
                              background: '#f8f9ff', borderTop: '2px solid #4f46e5',
                              padding: '20px 24px',
                            }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: '#4f46e5', marginBottom: 16 }}>
                                Editing — {firm.slug}
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                                {[
                                  ['name',          'Firm Name *',          'Smith & Associates'],
                                  ['tagline',        'Tagline',              "California Workers' Comp"],
                                  ['logo_url',       'Logo URL',             'https://...'],
                                  ['primary_color',  'Brand Color',          '#1a2e4a'],
                                  ['intake_emails',  'Notification Emails',  'a@firm.com, b@firm.com'],
                                  ['from_email',     'From Email',           'intakes@firm.com'],
                                  ['from_name',      'From Name',            'Smith & Associates'],
                                ].map(([key, label, ph]) => (
                                  <div key={key}>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                                      {label}
                                    </label>
                                    {key === 'primary_color' ? (
                                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <input type="color" value={editForm[key]}
                                          onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                                          style={{ width: 38, height: 34, borderRadius: 6, border: '1.5px solid #e5e7eb', cursor: 'pointer', padding: 2 }} />
                                        <input value={editForm[key]}
                                          onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                                          style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 12 }}
                                          onFocus={e => (e.target.style.borderColor = NAVY)}
                                          onBlur={e  => (e.target.style.borderColor = '#e5e7eb')} />
                                        <div style={{ width: 30, height: 30, borderRadius: 6, background: editForm.primary_color, border: '1px solid #e5e7eb', flexShrink: 0 }} />
                                      </div>
                                    ) : (
                                      <input
                                        value={editForm[key] ?? ''}
                                        onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                                        placeholder={ph}
                                        style={{ ...inputStyle, fontSize: 13 }}
                                        onFocus={e => (e.target.style.borderColor = NAVY)}
                                        onBlur={e  => (e.target.style.borderColor = '#e5e7eb')}
                                      />
                                    )}
                                  </div>
                                ))}
                              </div>
                              {saveErr && (
                                <div style={{ color: '#dc2626', fontSize: 12.5, marginTop: 10 }}>⚠️ {saveErr}</div>
                              )}
                              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                                <button
                                  onClick={handleSaveEdit}
                                  disabled={saving}
                                  style={{
                                    background: saving ? '#9ca3af' : '#4f46e5', color: 'white',
                                    border: 'none', borderRadius: 8, padding: '9px 24px',
                                    fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                                  }}
                                >{saving ? 'Saving…' : 'Save Changes'}</button>
                                <button
                                  onClick={() => setEditingSlug(null)}
                                  style={{
                                    background: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb',
                                    borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                  }}
                                >Cancel</button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  )
}

function linkBtn(bg, color) {
  return {
    background: bg, color, border: 'none', borderRadius: 6,
    padding: '4px 10px', fontSize: 11.5, fontWeight: 600,
    cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap',
    display: 'inline-block',
  }
}
