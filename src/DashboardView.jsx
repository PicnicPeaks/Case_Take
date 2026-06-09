import { useState, useEffect, useMemo } from 'react'
import { getIntakes } from './supabase.js'
import { onBrand } from './colorUtils.js'

const NAVY     = '#1a2e4a'
const SIBTF_COLOR = '#7c3aed'
const SIBTF_BG    = '#f5f3ff'

const VIA_COLOR = { Strong: '#16a34a', Moderate: '#ca8a04', Weak: '#ea580c', Declined: '#dc2626' }
const VIA_BG    = { Strong: '#f0fdf4', Moderate: '#fefce8', Weak: '#fff7ed',  Declined: '#fef2f2' }

const STATUS_STYLE = {
  pending:  { bg: '#eff6ff', color: '#1d4ed8', label: 'Pending Review' },
  accepted: { bg: '#f0fdf4', color: '#15803d', label: 'Accepted' },
  rejected: { bg: '#fef2f2', color: '#dc2626', label: 'Rejected' },
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDateShort(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 7) return `${days}d ago`
  return fmtDateShort(iso)
}

// ── Stat Card ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: 'white', borderRadius: 12, padding: '18px 22px',
      boxShadow: '0 1px 8px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb',
      borderTop: accent ? `3px solid ${accent}` : '3px solid transparent',
      flex: '1 1 0', minWidth: 120,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color: accent ?? NAVY, letterSpacing: '-1px', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ── Intake Row ─────────────────────────────────────────────────────────────────

function IntakeRow({ intake, isEven, firmSlug }) {
  const [hovered, setHovered] = useState(false)
  const isSIBTF  = intake.case_type === 'sibtf'
  const ss       = STATUS_STYLE[intake.status] ?? STATUS_STYLE.pending
  const segment  = isSIBTF ? 'sibtf' : 'intake'
  const caseUrl  = firmSlug
    ? `/firm/${encodeURIComponent(firmSlug)}/${segment}/${intake.id}`
    : `/case/${intake.id}`

  // Left stripe + viability badge colors
  const stripeColor = isSIBTF
    ? SIBTF_COLOR
    : (VIA_COLOR[intake.viability_label] ?? '#e5e7eb')

  return (
    <tr
      onClick={() => window.open(caseUrl, '_blank')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#f8fafc' : isEven ? 'white' : '#fafafa',
        cursor: 'pointer', transition: 'background 0.1s',
        borderBottom: '1px solid #f0f0f0',
      }}
    >
      {/* Color stripe */}
      <td style={{ width: 4, padding: 0, background: stripeColor }} />

      {/* Claimant */}
      <td style={{ padding: '13px 14px 13px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {isSIBTF && (
            <span style={{
              background: SIBTF_BG, color: SIBTF_COLOR,
              border: `1px solid ${SIBTF_COLOR}30`,
              borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 800,
              letterSpacing: '0.04em', flexShrink: 0,
            }}>SIBTF</span>
          )}
          <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', letterSpacing: '-0.2px' }}>
            {intake.claimant ?? '—'}
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 2 }}>
          {isSIBTF
            ? (intake.claim_number ? `Claim ${intake.claim_number}` : null)
            : intake.body_part ?? null}
        </div>
      </td>

      {/* Employer / DOI */}
      <td style={{ padding: '13px 14px' }}>
        {isSIBTF
          ? <span style={{ fontSize: 13, color: '#6b7280' }}>{intake.doi ? `DOI: ${intake.doi}` : '—'}</span>
          : <span style={{ fontSize: 13.5, color: '#374151' }}>{intake.employer ?? '—'}</span>
        }
      </td>

      {/* Date (injury date / intake date) */}
      <td style={{ padding: '13px 14px', whiteSpace: 'nowrap' }}>
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          {isSIBTF
            ? fmtDateShort(intake.intake_date)
            : fmtDateShort(intake.injury_date)}
        </div>
      </td>

      {/* Viability / Type */}
      <td style={{ padding: '13px 14px' }}>
        {isSIBTF ? (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: SIBTF_BG, border: `1px solid ${SIBTF_COLOR}30`,
            borderRadius: 20, padding: '3px 11px',
          }}>
            <span style={{ fontSize: 13 }}>🏛️</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: SIBTF_COLOR }}>SIBTF</span>
          </div>
        ) : intake.viability_label ? (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: VIA_BG[intake.viability_label] ?? '#f9fafb',
            border: `1px solid ${(VIA_COLOR[intake.viability_label] ?? '#9ca3af')}30`,
            borderRadius: 20, padding: '3px 11px',
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: VIA_COLOR[intake.viability_label] ?? '#9ca3af',
            }} />
            <span style={{
              fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
              color: VIA_COLOR[intake.viability_label] ?? '#9ca3af',
            }}>
              {intake.viability_label} · {intake.viability_score}
            </span>
          </div>
        ) : <span style={{ color: '#d1d5db', fontSize: 13 }}>—</span>}
      </td>

      {/* Flags / Docs needed */}
      <td style={{ padding: '13px 10px', textAlign: 'center' }}>
        {isSIBTF ? (
          intake.docs_needed > 0 ? (
            <span style={{
              display: 'inline-block', background: '#fef2f2', color: '#dc2626',
              borderRadius: 20, padding: '2px 9px', fontSize: 12, fontWeight: 700,
            }}>
              📋 {intake.docs_needed}
            </span>
          ) : (
            <span style={{
              display: 'inline-block', background: '#f0fdf4', color: '#15803d',
              borderRadius: 20, padding: '2px 9px', fontSize: 12, fontWeight: 700,
            }}>✓</span>
          )
        ) : (
          intake.red_flags > 0 ? (
            <span style={{
              display: 'inline-block', background: '#fff7ed', color: '#c2410c',
              borderRadius: 20, padding: '2px 9px', fontSize: 12, fontWeight: 700,
            }}>⚑ {intake.red_flags}</span>
          ) : (
            <span style={{ color: '#d1d5db', fontSize: 13 }}>—</span>
          )
        )}
      </td>

      {/* Status */}
      <td style={{ padding: '13px 14px' }}>
        <div style={{
          display: 'inline-block', background: ss.bg, color: ss.color,
          borderRadius: 20, padding: '3px 11px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
        }}>
          {ss.label}{intake.fluent_case_id ? ` #${intake.fluent_case_id}` : ''}
        </div>
      </td>

      {/* Received */}
      <td style={{ padding: '13px 14px', whiteSpace: 'nowrap' }}>
        <div style={{ fontSize: 12.5, color: '#6b7280' }}>{timeAgo(intake.created_at)}</div>
      </td>

      {/* Arrow */}
      <td style={{ padding: '13px 16px 13px 6px', textAlign: 'right' }}>
        <span style={{ fontSize: 16, color: hovered ? NAVY : '#d1d5db', transition: 'color 0.1s', fontWeight: 300 }}>→</span>
      </td>
    </tr>
  )
}

// ── Column headers ─────────────────────────────────────────────────────────────

const COLS_ALL  = [['Claimant','200px'],['Employer / DOI','170px'],['Date','90px'],['Rating / Type','140px'],['⚑ / Docs','70px'],['Status','140px'],['Received','90px'],['','40px']]
const COLS_WC   = [['Claimant','200px'],['Employer','170px'],['Injury','90px'],['Viability','140px'],['Flags','70px'],['Status','140px'],['Received','90px'],['','40px']]
const COLS_SIBTF= [['Claimant','200px'],['DOI','170px'],['Intake','90px'],['Type','140px'],['Docs Needed','90px'],['Status','140px'],['Received','90px'],['','40px']]

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ filtered }) {
  return (
    <tr>
      <td colSpan={9} style={{ padding: '52px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>{filtered ? '🔍' : '📋'}</div>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#374151', marginBottom: 6 }}>
          {filtered ? 'No matching intakes' : 'No intakes yet'}
        </div>
        <div style={{ fontSize: 13, color: '#9ca3af' }}>
          {filtered ? 'Try a different filter or search term' : 'Completed intakes will appear here'}
        </div>
      </td>
    </tr>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: 'newest',    label: 'Newest first' },
  { value: 'oldest',   label: 'Oldest first' },
  { value: 'score_hi', label: 'Score: high → low' },
  { value: 'score_lo', label: 'Score: low → high' },
]

export default function DashboardView({ firm = null, firmSlug: firmSlugProp = null }) {
  const BRAND   = firm?.primary_color ?? NAVY
  const ON      = onBrand(BRAND)
  const activeSlug = firmSlugProp ?? firm?.slug ?? null

  const [intakes,      setIntakes]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [typeTab,      setTypeTab]      = useState('all')      // all | workers_comp | sibtf
  const [statusTab,    setStatusTab]    = useState('all')      // all | pending | accepted | rejected
  const [search,       setSearch]       = useState('')
  const [sort,         setSort]         = useState('newest')
  const [lastRefresh,  setLastRefresh]  = useState(Date.now())

  const load = () => {
    setLoading(true)
    getIntakes(activeSlug)
      .then(data => {
        if (Array.isArray(data)) setIntakes(data)
        else setError(data.error ?? 'Failed to load intakes')
      })
      .catch(e => setError(e.message))
      .finally(() => { setLoading(false); setLastRefresh(Date.now()) })
  }

  useEffect(() => { load() }, [])

  // ── Derived stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const wc       = intakes.filter(r => r.case_type !== 'sibtf')
    const sibtf    = intakes.filter(r => r.case_type === 'sibtf')
    const pending  = intakes.filter(r => r.status === 'pending').length
    const accepted = intakes.filter(r => r.status === 'accepted').length
    const rejected = intakes.filter(r => r.status === 'rejected').length
    const scores   = wc.map(r => r.viability_score).filter(s => s != null)
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
    return { total: intakes.length, wc: wc.length, sibtf: sibtf.length, pending, accepted, rejected, avgScore }
  }, [intakes])

  // ── Filtered + sorted rows ─────────────────────────────────────────────────
  const rows = useMemo(() => {
    let list = intakes
    if (typeTab === 'workers_comp') list = list.filter(r => r.case_type !== 'sibtf')
    if (typeTab === 'sibtf')        list = list.filter(r => r.case_type === 'sibtf')
    if (statusTab !== 'all')        list = list.filter(r => r.status === statusTab)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        (r.claimant      ?? '').toLowerCase().includes(q) ||
        (r.employer      ?? '').toLowerCase().includes(q) ||
        (r.body_part     ?? '').toLowerCase().includes(q) ||
        (r.claim_number  ?? '').toLowerCase().includes(q) ||
        (r.doi           ?? '').toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => {
      if (sort === 'newest')   return new Date(b.created_at) - new Date(a.created_at)
      if (sort === 'oldest')   return new Date(a.created_at) - new Date(b.created_at)
      if (sort === 'score_hi') return (b.viability_score ?? -1) - (a.viability_score ?? -1)
      if (sort === 'score_lo') return (a.viability_score ?? 999) - (b.viability_score ?? 999)
      return 0
    })
  }, [intakes, typeTab, statusTab, search, sort])

  const cols = typeTab === 'sibtf' ? COLS_SIBTF : typeTab === 'workers_comp' ? COLS_WC : COLS_ALL
  const isFiltered = typeTab !== 'all' || statusTab !== 'all' || search.trim() !== ''

  // ── Tab button ─────────────────────────────────────────────────────────────
  function TabBtn({ value, label, count, active, onClick, color }) {
    const isActive = active
    const activeColor = color ?? BRAND
    return (
      <button
        onClick={onClick}
        style={{
          background:   isActive ? activeColor : 'transparent',
          color:        isActive ? 'white' : '#6b7280',
          border:       isActive ? `1.5px solid ${activeColor}` : '1.5px solid #e5e7eb',
          borderRadius: 8, padding: '6px 14px', fontSize: 13,
          fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          transition: 'all 0.12s',
        }}
        onMouseOver={e => !isActive && (e.currentTarget.style.borderColor = activeColor)}
        onMouseOut={e  => !isActive && (e.currentTarget.style.borderColor = '#e5e7eb')}
      >
        {label}
        {count != null && (
          <span style={{
            background:   isActive ? 'rgba(255,255,255,0.22)' : '#f3f4f6',
            color:        isActive ? 'white' : '#374151',
            borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 700,
          }}>{count}</span>
        )}
      </button>
    )
  }

  return (
    <div style={{
      minHeight: '100svh', background: '#f3f4f6',
      fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif",
    }}>

      {/* ── Header ── */}
      <header style={{
        background: BRAND, padding: '0 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 60, flexShrink: 0, boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href={firm ? `/firm/${firm.slug}` : '/'}
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            {firm?.logo_url
              ? <img src={firm.logo_url} alt={firm.name} style={{ height: 32, objectFit: 'contain' }} />
              : <>
                  <div style={{
                    width: 36, height: 36, borderRadius: 9, background: ON.btnBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  }}>⚖️</div>
                  <div>
                    <div style={{ color: ON.text, fontWeight: 800, fontSize: 15, lineHeight: 1 }}>
                      {firm?.name ?? 'CaseTake'}
                    </div>
                    <div style={{ color: ON.textMuted, fontSize: 10.5 }}>
                      {firm?.tagline ?? "California • Workers' Comp"}
                    </div>
                  </div>
                </>
            }
          </a>
          <div style={{ width: 1, height: 28, background: ON.btnBorder, margin: '0 6px' }} />
          <div style={{ color: ON.text, fontWeight: 700, fontSize: 14, opacity: 0.9 }}>Intake Dashboard</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: ON.textMuted }}>Updated {timeAgo(new Date(lastRefresh).toISOString())}</span>
          <button onClick={load} disabled={loading} style={{
            background: ON.btnBg, color: ON.btnText, border: `1.5px solid ${ON.btnBorder}`,
            borderRadius: 7, padding: '6px 14px', fontSize: 12.5, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1,
          }}>{loading ? '⟳ Loading…' : '⟳ Refresh'}</button>
          {activeSlug && (
            <a href={`/firm/${activeSlug}/settings`} style={{
              background: ON.btnBg, color: ON.btnText, border: `1px solid ${ON.btnBorder}`,
              borderRadius: 7, padding: '6px 14px', fontSize: 12.5, fontWeight: 600, textDecoration: 'none',
            }}>⚙ Settings</a>
          )}
          {firm && (
            <a href={`/firm/${firm.slug}/sibtf`} style={{
              background: ON.btnBg, color: ON.btnText, border: `1px solid ${ON.btnBorder}`,
              borderRadius: 7, padding: '6px 14px', fontSize: 12.5, fontWeight: 600, textDecoration: 'none',
            }}>+ SIBTF</a>
          )}
          <a href={firm ? `/firm/${firm.slug}` : '/'} style={{
            background: ON.btnPrimary, color: ON.btnPrimaryText, border: 'none',
            borderRadius: 7, padding: '6px 16px', fontSize: 12.5, fontWeight: 700,
            cursor: 'pointer', textDecoration: 'none',
          }}>+ Intake</a>
          {firm?.has_dashboard_password && activeSlug && (
            <button onClick={() => {
              localStorage.removeItem(`ct_firm_auth_${activeSlug}`)
              window.location.reload()
            }} style={{
              background: ON.btnBg, color: ON.btnText, border: `1px solid ${ON.btnBorder}`,
              borderRadius: 7, padding: '6px 13px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>Sign out</button>
          )}
        </div>
      </header>

      <div style={{ padding: '28px 24px 60px' }}>

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
            padding: '14px 18px', marginBottom: 22, color: '#dc2626', fontSize: 13,
          }}>⚠️ {error}</div>
        )}

        {/* ── Stats ── */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
          <StatCard label="Total"          value={stats.total}    accent={NAVY} />
          <StatCard label="Workers' Comp"  value={stats.wc}       accent={NAVY}
            sub={stats.wc === 1 ? '1 intake' : `${stats.wc} intakes`} />
          <StatCard label="SIBTF"          value={stats.sibtf}    accent={SIBTF_COLOR}
            sub={stats.sibtf === 1 ? '1 case' : `${stats.sibtf} cases`} />
          <StatCard label="Pending Review" value={stats.pending}  accent="#1d4ed8"
            sub={stats.pending > 0 ? `${stats.pending} need${stats.pending === 1 ? 's' : ''} review` : 'All reviewed'} />
          <StatCard label="Accepted"       value={stats.accepted} accent="#16a34a" />
          <StatCard label="W/C Avg Score"
            value={stats.avgScore != null ? `${stats.avgScore}` : '—'}
            sub="viability"
            accent={
              stats.avgScore == null ? '#9ca3af' :
              stats.avgScore >= 80 ? '#16a34a' :
              stats.avgScore >= 60 ? '#ca8a04' :
              stats.avgScore >= 40 ? '#ea580c' : '#dc2626'
            } />
        </div>

        {/* ── Filters ── */}
        <div style={{
          background: 'white', borderRadius: 12, padding: '14px 18px',
          boxShadow: '0 1px 6px rgba(0,0,0,0.07)', border: '1px solid #e5e7eb',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>

            {/* Type filter */}
            <div style={{ display: 'flex', gap: 6 }}>
              <TabBtn value="all"         label="All types"   count={stats.total}  active={typeTab === 'all'}         onClick={() => setTypeTab('all')} />
              <TabBtn value="workers_comp" label="Workers' Comp" count={stats.wc}  active={typeTab === 'workers_comp'} onClick={() => setTypeTab('workers_comp')} />
              <TabBtn value="sibtf"       label="🏛️ SIBTF"    count={stats.sibtf}  active={typeTab === 'sibtf'}        onClick={() => setTypeTab('sibtf')} color={SIBTF_COLOR} />
            </div>

            <div style={{ width: 1, height: 28, background: '#e5e7eb', flexShrink: 0 }} />

            {/* Status filter */}
            <div style={{ display: 'flex', gap: 6 }}>
              <TabBtn value="all"      label="All statuses" active={statusTab === 'all'}      onClick={() => setStatusTab('all')} />
              <TabBtn value="pending"  label="Pending"      active={statusTab === 'pending'}  onClick={() => setStatusTab('pending')} />
              <TabBtn value="accepted" label="Accepted"     active={statusTab === 'accepted'} onClick={() => setStatusTab('accepted')} />
              <TabBtn value="rejected" label="Rejected"     active={statusTab === 'rejected'} onClick={() => setStatusTab('rejected')} />
            </div>

            {/* Search + sort */}
            <div style={{ flex: 1, minWidth: 160, position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                color: '#9ca3af', fontSize: 13, pointerEvents: 'none',
              }}>🔍</span>
              <input
                placeholder="Search claimant, employer, DOI…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  border: '1.5px solid #e5e7eb', borderRadius: 8,
                  padding: '7px 12px 7px 30px', fontSize: 13, fontFamily: 'inherit',
                  outline: 'none', color: '#111827',
                }}
                onFocus={e => (e.target.style.borderColor = BRAND)}
                onBlur={e  => (e.target.style.borderColor = '#e5e7eb')}
              />
            </div>

            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              style={{
                border: '1.5px solid #e5e7eb', borderRadius: 8,
                padding: '7px 12px', fontSize: 13, fontFamily: 'inherit',
                color: '#374151', background: 'white', cursor: 'pointer', outline: 'none',
              }}
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* ── Table ── */}
        <div style={{
          background: 'white', borderRadius: 12,
          boxShadow: '0 1px 6px rgba(0,0,0,0.07)', border: '1px solid #e5e7eb',
          overflowX: 'auto',
        }}>
          {loading ? (
            <div style={{ padding: '56px 0', textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: 28, marginBottom: 10, animation: 'spin 1s linear infinite' }}>⚖️</div>
              <div style={{ fontSize: 13 }}>Loading intakes…</div>
            </div>
          ) : (
            <table style={{ width: '100%', minWidth: 860, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f0f0f0', background: '#fafafa' }}>
                  <th style={{ width: 4, padding: 0 }} />
                  {cols.map(([label, w]) => (
                    <th key={label} style={{
                      padding: '10px 14px', textAlign: 'left',
                      fontSize: 10.5, fontWeight: 700, color: '#9ca3af',
                      textTransform: 'uppercase', letterSpacing: '0.06em', width: w,
                    }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0
                  ? <EmptyState filtered={isFiltered} />
                  : rows.map((intake, i) => (
                    <IntakeRow key={intake.id} intake={intake} isEven={i % 2 === 0} firmSlug={activeSlug} />
                  ))
                }
              </tbody>
            </table>
          )}
        </div>

        {!loading && rows.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#9ca3af', textAlign: 'right' }}>
            {rows.length} {rows.length === 1 ? 'record' : 'records'}{isFiltered ? ' matching' : ' total'}
          </div>
        )}

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        tbody tr:last-child { border-bottom: none; }
      `}</style>
    </div>
  )
}
