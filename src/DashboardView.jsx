import { useState, useEffect, useMemo } from 'react'
import { getIntakes } from './supabase.js'

const NAVY       = '#1a2e4a'
const NAVY_MID   = '#243d5e'

const VIA_COLOR  = { Strong: '#16a34a', Moderate: '#ca8a04', Weak: '#ea580c', Declined: '#dc2626' }
const VIA_BG     = { Strong: '#f0fdf4', Moderate: '#fefce8', Weak: '#fff7ed',  Declined: '#fef2f2' }
const VIA_ORDER  = { Strong: 4, Moderate: 3, Weak: 2, Declined: 1 }

const STATUS_STYLE = {
  pending:  { bg: '#eff6ff', color: '#1d4ed8', label: 'Pending Review' },
  accepted: { bg: '#f0fdf4', color: '#15803d', label: 'Accepted' },
  rejected: { bg: '#fef2f2', color: '#dc2626', label: 'Rejected' },
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDateShort(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
  return fmtDate(iso)
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

// ── Row ────────────────────────────────────────────────────────────────────────

function IntakeRow({ intake, isEven }) {
  const [hovered, setHovered] = useState(false)
  const label  = intake.viability_label ?? ''
  const color  = VIA_COLOR[label]  ?? '#9ca3af'
  const bg     = VIA_BG[label]     ?? '#f9fafb'
  const ss     = STATUS_STYLE[intake.status] ?? STATUS_STYLE.pending
  const caseUrl = `?case=${intake.id}`

  return (
    <tr
      onClick={() => window.open(caseUrl, '_blank')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#f8fafc' : isEven ? 'white' : '#fafafa',
        cursor: 'pointer',
        transition: 'background 0.1s',
        borderBottom: '1px solid #f0f0f0',
      }}
    >
      {/* Viability stripe */}
      <td style={{ width: 4, padding: 0, background: color }} />

      {/* Claimant */}
      <td style={{ padding: '13px 14px 13px 16px' }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', letterSpacing: '-0.2px' }}>
          {intake.claimant ?? '—'}
        </div>
        {intake.body_part && (
          <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 2 }}>
            {intake.body_part}
          </div>
        )}
      </td>

      {/* Employer */}
      <td style={{ padding: '13px 14px' }}>
        <div style={{ fontSize: 13.5, color: '#374151' }}>{intake.employer ?? '—'}</div>
      </td>

      {/* Injury date */}
      <td style={{ padding: '13px 14px', whiteSpace: 'nowrap' }}>
        <div style={{ fontSize: 13, color: '#6b7280' }}>{fmtDateShort(intake.injury_date)}</div>
      </td>

      {/* Viability */}
      <td style={{ padding: '13px 14px' }}>
        {label ? (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: bg, border: `1px solid ${color}30`,
            borderRadius: 20, padding: '3px 11px',
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 700, color, whiteSpace: 'nowrap' }}>
              {label} · {intake.viability_score}
            </span>
          </div>
        ) : <span style={{ color: '#d1d5db', fontSize: 13 }}>—</span>}
      </td>

      {/* Red flags */}
      <td style={{ padding: '13px 10px', textAlign: 'center' }}>
        {intake.red_flags > 0 ? (
          <span style={{
            display: 'inline-block', background: '#fff7ed', color: '#c2410c',
            borderRadius: 20, padding: '2px 9px', fontSize: 12, fontWeight: 700,
          }}>
            ⚑ {intake.red_flags}
          </span>
        ) : (
          <span style={{ color: '#d1d5db', fontSize: 13 }}>—</span>
        )}
      </td>

      {/* Status */}
      <td style={{ padding: '13px 14px' }}>
        <div style={{
          display: 'inline-block', background: ss.bg, color: ss.color,
          borderRadius: 20, padding: '3px 11px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
        }}>
          {ss.label}
          {intake.fluent_case_id ? ` #${intake.fluent_case_id}` : ''}
        </div>
      </td>

      {/* Received */}
      <td style={{ padding: '13px 14px', whiteSpace: 'nowrap' }}>
        <div style={{ fontSize: 12.5, color: '#6b7280' }}>{timeAgo(intake.created_at)}</div>
      </td>

      {/* Arrow */}
      <td style={{ padding: '13px 16px 13px 6px', textAlign: 'right' }}>
        <span style={{
          fontSize: 16, color: hovered ? NAVY : '#d1d5db',
          transition: 'color 0.1s', fontWeight: 300,
        }}>→</span>
      </td>
    </tr>
  )
}

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
  { value: 'oldest',    label: 'Oldest first' },
  { value: 'score_hi',  label: 'Score: high → low' },
  { value: 'score_lo',  label: 'Score: low → high' },
]

export default function DashboardView({ firm = null }) {
  const BRAND = firm?.primary_color ?? NAVY

  const [intakes,  setIntakes]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [tab,      setTab]      = useState('all')
  const [search,   setSearch]   = useState('')
  const [sort,     setSort]     = useState('newest')
  const [lastRefresh, setLastRefresh] = useState(Date.now())

  const load = () => {
    setLoading(true)
    getIntakes(firm?.slug ?? null)
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
    const total    = intakes.length
    const pending  = intakes.filter(r => r.status === 'pending').length
    const accepted = intakes.filter(r => r.status === 'accepted').length
    const rejected = intakes.filter(r => r.status === 'rejected').length
    const scores   = intakes.map(r => r.viability_score).filter(s => s != null)
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
    return { total, pending, accepted, rejected, avgScore }
  }, [intakes])

  // ── Filtered + sorted rows ─────────────────────────────────────────────────
  const rows = useMemo(() => {
    let list = intakes
    if (tab !== 'all') list = list.filter(r => r.status === tab)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        (r.claimant ?? '').toLowerCase().includes(q) ||
        (r.employer ?? '').toLowerCase().includes(q) ||
        (r.body_part ?? '').toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => {
      if (sort === 'newest')   return new Date(b.created_at) - new Date(a.created_at)
      if (sort === 'oldest')   return new Date(a.created_at) - new Date(b.created_at)
      if (sort === 'score_hi') return (b.viability_score ?? 0) - (a.viability_score ?? 0)
      if (sort === 'score_lo') return (a.viability_score ?? 0) - (b.viability_score ?? 0)
      return 0
    })
  }, [intakes, tab, search, sort])

  // ── Tab button ─────────────────────────────────────────────────────────────
  function TabBtn({ value, label, count }) {
    const active = tab === value
    return (
      <button
        onClick={() => setTab(value)}
        style={{
          background:  active ? BRAND : 'transparent',
          color:       active ? 'white' : '#6b7280',
          border:      active ? `1.5px solid ${BRAND}` : '1.5px solid #e5e7eb',
          borderRadius: 8, padding: '7px 16px', fontSize: 13,
          fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
          transition: 'all 0.12s',
        }}
        onMouseOver={e => !active && (e.currentTarget.style.borderColor = BRAND)}
        onMouseOut={e  => !active && (e.currentTarget.style.borderColor = '#e5e7eb')}
      >
        {label}
        {count != null && (
          <span style={{
            background:  active ? 'rgba(255,255,255,0.2)' : '#f3f4f6',
            color:       active ? 'white' : '#374151',
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
        background: BRAND,
        padding: '0 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 60, flexShrink: 0, boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a
            href={firm ? `/?firm=${firm.slug}` : '/'}
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}
          >
            {firm?.logo_url
              ? <img src={firm.logo_url} alt={firm.name} style={{ height: 32, objectFit: 'contain' }} />
              : <div style={{
                  width: 36, height: 36, borderRadius: 9,
                  background: 'rgba(255,255,255,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>⚖️</div>
            }
            <div>
              <div style={{ color: 'white', fontWeight: 800, fontSize: 15, lineHeight: 1 }}>
                {firm?.name ?? 'CaseTake'}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10.5 }}>
                {firm?.tagline ?? "California • Workers' Comp"}
              </div>
            </div>
          </a>
          <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.15)', margin: '0 6px' }} />
          <div style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: 14 }}>
            Intake Dashboard
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
            Updated {timeAgo(new Date(lastRefresh).toISOString())}
          </span>
          <button
            onClick={load}
            disabled={loading}
            style={{
              background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)',
              border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 7,
              padding: '6px 14px', fontSize: 12.5, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1,
            }}
          >{loading ? '⟳ Loading…' : '⟳ Refresh'}</button>
          <a
            href={firm ? `/?firm=${firm.slug}` : '/'}
            style={{
              background: 'white', color: BRAND,
              border: 'none', borderRadius: 7,
              padding: '6px 16px', fontSize: 12.5, fontWeight: 700,
              cursor: 'pointer', textDecoration: 'none',
            }}
          >+ New Intake</a>
        </div>
      </header>

      <div style={{ padding: '28px 24px 60px' }}>

        {/* ── Error ── */}
        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
            padding: '14px 18px', marginBottom: 22, color: '#dc2626', fontSize: 13,
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── Stats row ── */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
          <StatCard label="Total Intakes"   value={stats.total}    accent={NAVY} />
          <StatCard label="Pending Review"  value={stats.pending}  accent="#1d4ed8"
            sub={stats.pending === 1 ? '1 needs review' : stats.pending > 0 ? `${stats.pending} need review` : 'All reviewed'} />
          <StatCard label="Accepted"        value={stats.accepted} accent="#16a34a"
            sub={stats.accepted > 0 ? 'Sent to Fluent Case' : null} />
          <StatCard label="Rejected"        value={stats.rejected} accent="#dc2626" />
          <StatCard label="Avg Score"
            value={stats.avgScore != null ? `${stats.avgScore}` : '—'}
            sub="viability"
            accent={stats.avgScore >= 80 ? '#16a34a' : stats.avgScore >= 60 ? '#ca8a04' : stats.avgScore >= 40 ? '#ea580c' : '#dc2626'} />
        </div>

        {/* ── Filters + search ── */}
        <div style={{
          background: 'white', borderRadius: 12, padding: '16px 20px',
          boxShadow: '0 1px 6px rgba(0,0,0,0.07)', border: '1px solid #e5e7eb',
          marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <TabBtn value="all"      label="All"      count={stats.total} />
            <TabBtn value="pending"  label="Pending"  count={stats.pending} />
            <TabBtn value="accepted" label="Accepted" count={stats.accepted} />
            <TabBtn value="rejected" label="Rejected" count={stats.rejected} />
          </div>

          <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
              color: '#9ca3af', fontSize: 14, pointerEvents: 'none',
            }}>🔍</span>
            <input
              placeholder="Search claimant, employer…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                border: '1.5px solid #e5e7eb', borderRadius: 8,
                padding: '7px 12px 7px 32px', fontSize: 13, fontFamily: 'inherit',
                outline: 'none', color: '#111827',
              }}
              onFocus={e  => (e.target.style.borderColor = NAVY)}
              onBlur={e   => (e.target.style.borderColor = '#e5e7eb')}
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
                  {[
                    ['Claimant',   '200px'],
                    ['Employer',   '180px'],
                    ['Injury',     '90px'],
                    ['Viability',  '140px'],
                    ['Flags',      '70px'],
                    ['Status',     '140px'],
                    ['Received',   '90px'],
                    ['',           '40px'],
                  ].map(([label, w]) => (
                    <th key={label} style={{
                      padding: '10px 14px', textAlign: 'left',
                      fontSize: 10.5, fontWeight: 700, color: '#9ca3af',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      width: w,
                    }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0
                  ? <EmptyState filtered={tab !== 'all' || search.trim() !== ''} />
                  : rows.map((intake, i) => (
                    <IntakeRow key={intake.id} intake={intake} isEven={i % 2 === 0} />
                  ))
                }
              </tbody>
            </table>
          )}
        </div>

        {/* Row count */}
        {!loading && rows.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#9ca3af', textAlign: 'right' }}>
            {rows.length} {rows.length === 1 ? 'intake' : 'intakes'}
            {tab !== 'all' || search ? ` matching` : ` total`}
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
