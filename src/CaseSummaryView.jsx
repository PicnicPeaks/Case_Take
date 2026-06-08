import { useState, useEffect } from 'react'
import { getCaseSummary, acceptCase, rejectCase } from './supabase.js'
import { onBrand } from './colorUtils.js'

// ── Brand ──────────────────────────────────────────────────────────────────────
const NAVY = '#1a2e4a'

const VIA_COLOR = { Strong: '#16a34a', Moderate: '#ca8a04', Weak: '#ea580c', Declined: '#dc2626' }
const VIA_BG    = { Strong: '#f0fdf4', Moderate: '#fefce8', Weak: '#fff7ed',  Declined: '#fef2f2' }

// ── Small helpers ──────────────────────────────────────────────────────────────

function val(v) {
  const s = String(v ?? '').trim()
  return (s && s !== 'N/A' && s !== 'None provided' && s !== 'None reported')
    ? s
    : null
}

function Field({ label, value }) {
  const v = val(value)
  return (
    <div style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{
        flex: '0 0 180px', fontSize: 11, fontWeight: 700, color: '#6b7280',
        textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: 1,
      }}>{label}</div>
      <div style={{ flex: 1, fontSize: 13.5, color: v ? '#111827' : '#d1d5db', lineHeight: 1.55 }}>
        {v ?? '—'}
      </div>
    </div>
  )
}

function Section({ icon, title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: '2px solid #e5e7eb', paddingBottom: 7, marginBottom: 14,
      }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{
          fontWeight: 800, fontSize: 11, color: NAVY,
          textTransform: 'uppercase', letterSpacing: '0.07em',
        }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

// ── Confirm dialog (inline, no native browser confirm) ─────────────────────────

function ConfirmDialog({ message, confirmLabel, confirmStyle, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, animation: 'fadeIn .15s ease',
    }}>
      <div style={{
        background: 'white', borderRadius: 14, padding: '28px 32px',
        maxWidth: 380, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        animation: 'scaleIn .15s ease',
      }}>
        <div style={{ fontSize: 15, color: '#111827', lineHeight: 1.6, marginBottom: 22 }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              background: 'none', border: '1.5px solid #d1d5db', borderRadius: 8,
              padding: '9px 20px', fontSize: 14, cursor: 'pointer', color: '#374151', fontWeight: 600,
            }}
          >Cancel</button>
          <button
            onClick={onConfirm}
            style={{
              background: confirmStyle === 'danger' ? '#dc2626' : '#16a34a',
              color: 'white', border: 'none', borderRadius: 8,
              padding: '9px 20px', fontSize: 14, cursor: 'pointer', fontWeight: 700,
            }}
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

// ── Status banner ──────────────────────────────────────────────────────────────

function StatusBanner({ status, fluentCaseId }) {
  if (status === 'accepted') {
    return (
      <div style={{
        background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 10,
        padding: '14px 18px', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 22 }}>✅</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#15803d' }}>Case Accepted</div>
          {fluentCaseId && (
            <div style={{ fontSize: 13, color: '#16a34a', marginTop: 2 }}>
              Created in Fluent Case as matter{' '}
              <a
                href={`https://app.fluentcase.com/matters/${fluentCaseId}`}
                target="_blank" rel="noreferrer"
                style={{ color: '#15803d', fontWeight: 700 }}
              >#{fluentCaseId}</a>
            </div>
          )}
        </div>
      </div>
    )
  }
  if (status === 'rejected') {
    return (
      <div style={{
        background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 10,
        padding: '14px 18px', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 22 }}>❌</span>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#dc2626' }}>Case Rejected</div>
      </div>
    )
  }
  return null
}

// ── Main view ──────────────────────────────────────────────────────────────────

export default function CaseSummaryView({ caseId, firmSlug = null, firm = null }) {
  const BRAND = firm?.primary_color ?? NAVY
  const ON    = onBrand(BRAND)
  const [caseData,   setCaseData]   = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [loadError,  setLoadError]  = useState(null)
  const [confirm,    setConfirm]    = useState(null)   // 'accept' | 'reject' | null
  const [actionBusy, setActionBusy] = useState(false)
  const [actionErr,  setActionErr]  = useState(null)

  useEffect(() => {
    getCaseSummary(caseId, firmSlug)
      .then(data => {
        if (data.error) setLoadError(data.error)
        else            setCaseData(data)
      })
      .catch(e => setLoadError(e.message))
      .finally(() => setLoading(false))
  }, [caseId, firmSlug])

  const handleAccept = async () => {
    setConfirm(null)
    setActionBusy(true)
    setActionErr(null)
    try {
      const res = await acceptCase(caseId, firmSlug)
      if (res.error) {
        setActionErr(res.error + (res.details ? ` — ${JSON.stringify(res.details)}` : ''))
      } else {
        setCaseData(prev => ({
          ...prev,
          status:         'accepted',
          fluent_case_id: res.fluent_case_id ?? prev.fluent_case_id,
        }))
      }
    } catch (e) {
      setActionErr(e.message)
    } finally {
      setActionBusy(false)
    }
  }

  const handleReject = async () => {
    setConfirm(null)
    setActionBusy(true)
    setActionErr(null)
    try {
      const res = await rejectCase(caseId, '', firmSlug)
      if (res.error) {
        setActionErr(res.error)
      } else {
        setCaseData(prev => ({ ...prev, status: 'rejected' }))
      }
    } catch (e) {
      setActionErr(e.message)
    } finally {
      setActionBusy(false)
    }
  }

  // ── Loading / error states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{
        minHeight: '100svh', background: '#f3f4f6',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif",
      }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>
          <div style={{ fontSize: 32, marginBottom: 12, animation: 'spin 1s linear infinite' }}>⚖️</div>
          <div style={{ fontSize: 14 }}>Loading intake report…</div>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div style={{
        minHeight: '100svh', background: '#f3f4f6',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif",
      }}>
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#111827', marginBottom: 8 }}>Report Not Found</div>
          <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.65 }}>
            This link may be invalid or the case may have been removed. Check the URL and try again.
          </div>
        </div>
      </div>
    )
  }

  const s            = (caseData.summary ?? {})
  const status       = caseData.status    ?? 'pending'
  const fluentCaseId = caseData.fluent_case_id
  const label        = String(s.viability_label ?? '')
  const color        = VIA_COLOR[label]   ?? '#6b7280'
  const bg           = VIA_BG[label]      ?? '#f9fafb'
  const score        = s.viability_score  ?? '—'
  const flags        = Array.isArray(s.red_flags) ? s.red_flags : []
  const isPending    = status === 'pending'

  return (
    <div style={{
      minHeight: '100svh', background: '#f3f4f6',
      fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif",
    }}>
      <style>{`
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes scaleIn { from { transform: scale(0.94); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes spin    { to { transform: rotate(360deg) } }
      `}</style>

      {/* ── Firm header bar ── */}
      <header style={{
        background: BRAND, height: 58, padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 2px 10px rgba(0,0,0,0.18)', flexShrink: 0,
      }}>
        <a
          href={firm ? `/?firm=${firm.slug}&view=dashboard` : '/'}
          style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}
        >
          {firm?.logo_url
            ? <img src={firm.logo_url} alt={firm.name} style={{ height: 30, objectFit: 'contain' }} />
            : <span style={{ fontSize: 20 }}>⚖️</span>
          }
          <div>
            <div style={{ color: ON.text, fontWeight: 800, fontSize: 15, lineHeight: 1 }}>
              {firm?.name ?? 'CaseTake'}
            </div>
            <div style={{ color: ON.textMuted, fontSize: 10.5, marginTop: 1 }}>
              {firm?.tagline ?? "California Workers' Compensation"}
            </div>
          </div>
        </a>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {firm && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'white', borderRadius: 20,
              padding: '4px 10px 4px 8px', boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
            }}>
              <span style={{ fontSize: 11 }}>⚖️</span>
              <span style={{ color: NAVY, fontSize: 10, fontWeight: 700 }}>Powered by CaseTake</span>
            </div>
          )}
          {firm && (
            <a href={`/?firm=${firm.slug}&view=dashboard`} style={{
              background: ON.btnBg, color: ON.btnText,
              border: `1px solid ${ON.btnBorder}`, borderRadius: 7,
              padding: '6px 13px', fontSize: 12.5, fontWeight: 600, textDecoration: 'none',
            }}>← Dashboard</a>
          )}
        </div>
      </header>

      {/* Confirm dialog */}
      {confirm === 'accept' && (
        <ConfirmDialog
          message="Accept this intake and create a new matter in Fluent Case? This will send the case data to your case management system."
          confirmLabel="Yes, Accept Case"
          confirmStyle="success"
          onConfirm={handleAccept}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'reject' && (
        <ConfirmDialog
          message="Reject this intake? The case will be marked as rejected and no matter will be created."
          confirmLabel="Reject Case"
          confirmStyle="danger"
          onConfirm={handleReject}
          onCancel={() => setConfirm(null)}
        />
      )}

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 16px 60px' }}>

        {/* ── Letterhead ── */}
        <div style={{
          background: BRAND, borderRadius: '12px 12px 0 0',
          padding: '24px 30px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            {firm?.logo_url ? (
              <div style={{
                background: 'white', borderRadius: 10, padding: '7px 14px',
                boxShadow: '0 1px 6px rgba(0,0,0,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <img
                  src={firm.logo_url}
                  alt={firm.name}
                  style={{ maxHeight: 38, maxWidth: 140, objectFit: 'contain', display: 'block' }}
                />
              </div>
            ) : (
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: ON.btnBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
              }}>⚖️</div>
            )}
            <div>
              <div style={{ color: ON.text, fontWeight: 900, fontSize: 18, letterSpacing: '-0.3px' }}>
                {firm?.name ?? 'CaseTake'}
              </div>
              <div style={{ color: ON.textMuted, fontSize: 11, marginTop: 1 }}>
                {firm?.tagline ?? "California Workers' Compensation"}
              </div>
            </div>
          </div>
          <div style={{ color: ON.text, fontWeight: 900, fontSize: 22, letterSpacing: '-0.5px', marginBottom: 4 }}>
            Intake Screening Report
          </div>
          <div style={{ color: ON.textMuted, fontSize: 13 }}>
            {s.claimant} &nbsp;·&nbsp; {s.intake_date}
          </div>
        </div>

        {/* ── Card body ── */}
        <div style={{
          background: 'white', borderRadius: '0 0 12px 12px',
          padding: '28px 30px 32px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
        }}>

          {/* Status banner (accepted / rejected) */}
          <StatusBanner status={status} fluentCaseId={fluentCaseId} />

          {/* Viability badge */}
          <div style={{
            background: bg, border: `1.5px solid ${color}40`, borderRadius: 10,
            padding: '16px 20px', marginBottom: 28,
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: color, color: 'white', borderRadius: 20,
              padding: '4px 16px', fontWeight: 800, fontSize: 14, marginBottom: 10,
            }}>
              <span>{label}</span>
              <span style={{ opacity: 0.75 }}>·</span>
              <span>{score}/100</span>
            </div>
            <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.7 }}>
              {s.recommendation}
            </div>
          </div>

          {/* Red flags */}
          {flags.length > 0 && (
            <Section icon="⚠️" title="Red Flags">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {flags.map((f, i) => (
                  <div key={i} style={{
                    background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 7,
                    padding: '8px 13px', fontSize: 13, color: '#9a3412', lineHeight: 1.55,
                  }}>
                    ⚑ {String(f)}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Client Information */}
          <Section icon="👤" title="Client Information">
            <Field label="Full Name"        value={s.claimant} />
            <Field label="Phone"            value={s.phone} />
            <Field label="Email"            value={s.email} />
            <Field label="Intake Date"      value={s.intake_date} />
            <Field label="Attorney Status"  value={s.attorney_represented} />
          </Section>

          {/* Employment */}
          <Section icon="🏢" title="Employment">
            <Field label="Employer"         value={s.employer} />
            <Field label="Job Title"        value={s.job_title} />
            <Field label="Employment Type"  value={s.employment_type} />
            <Field label="Hours / Week"     value={s.hours_per_week} />
          </Section>

          {/* Injury Details */}
          <Section icon="🩹" title="Injury Details">
            <Field label="Date of Injury"   value={s.injury_date} />
            <Field label="Time"             value={s.injury_time} />
            <Field label="Location"         value={s.injury_location} />
            <Field label="Body Part(s)"     value={s.body_part} />
            <Field label="Current Status"   value={s.current_status} />
            {val(s.injury_description) && (
              <div style={{ marginTop: 12 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: '#6b7280',
                  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6,
                }}>How It Happened</div>
                <div style={{ fontSize: 13.5, color: '#111827', lineHeight: 1.7 }}>
                  {s.injury_description}
                </div>
              </div>
            )}
          </Section>

          {/* Reporting */}
          <Section icon="📋" title="Reporting">
            <Field label="Reported to Employer"  value={s.reported_to_employer} />
            <Field label="Written Report Filed"  value={s.written_report_filed} />
            <Field label="DWC-1 Claim Form"      value={s.dwc1_provided} />
            <Field label="Adjuster Contacted"    value={s.adjuster_contacted} />
          </Section>

          {/* Medical Treatment */}
          <Section icon="🏥" title="Medical Treatment">
            <Field label="Facility"         value={s.medical_facility} />
            <Field label="Doctor"           value={s.treating_doctor} />
            <Field label="First Visit"      value={s.first_treatment_date} />
            <Field label="Treating Via"     value={s.treating_type} />
          </Section>

          {/* Claim Status */}
          <Section icon="⚖️" title="Claim Status & Medical Disputes">
            <Field label="Claim Decision"     value={s.claim_status} />
            <Field label="Denial Reason"      value={s.denial_reason} />
            <Field label="Treatment Denied"   value={s.treatment_denied} />
            <Field label="QME / AME Stage"    value={s.qme_stage} />
            <Field label="QME / AME Findings" value={s.qme_findings} />
            <Field label="P&S Declared"       value={s.ps_declared} />
          </Section>

          {/* Witnesses */}
          <Section icon="👥" title="Witnesses">
            <Field label="Witness Info" value={s.witnesses} />
          </Section>

          {/* Prior Injury History */}
          <Section icon="📁" title="Prior Injury History">
            <Field label="Prior Injuries" value={s.prior_injuries} />
          </Section>

          {/* Recorded Statements */}
          <Section icon="🎙️" title="Recorded Statements">
            <Field label="Statement Given" value={s.recorded_statement} />
            <Field label="Details"         value={s.recorded_statement_details} />
          </Section>

          {/* Attorney Notes */}
          {val(s.notes) && (
            <Section icon="📝" title="Attorney Notes">
              <div style={{
                background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
                padding: '13px 16px', fontSize: 13.5, color: '#78350f', lineHeight: 1.7,
              }}>
                {s.notes}
              </div>
            </Section>
          )}

          {/* ── Action buttons ── */}
          {isPending && (
            <div style={{
              borderTop: '2px solid #e5e7eb', paddingTop: 24, marginTop: 8,
              display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap',
            }}>
              {actionErr && (
                <div style={{
                  flex: '1 1 100%', background: '#fef2f2', border: '1px solid #fecaca',
                  borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626',
                }}>
                  ⚠️ {actionErr}
                </div>
              )}
              <button
                onClick={() => setConfirm('reject')}
                disabled={actionBusy}
                style={{
                  background: 'white', color: '#dc2626',
                  border: '1.5px solid #fca5a5', borderRadius: 9,
                  padding: '11px 28px', fontSize: 14, fontWeight: 700, cursor: actionBusy ? 'not-allowed' : 'pointer',
                  opacity: actionBusy ? 0.6 : 1, transition: 'all 0.15s',
                }}
                onMouseOver={e => !actionBusy && (e.currentTarget.style.background = '#fef2f2')}
                onMouseOut={e  => !actionBusy && (e.currentTarget.style.background = 'white')}
              >
                ✕ Reject
              </button>
              <button
                onClick={() => setConfirm('accept')}
                disabled={actionBusy}
                style={{
                  background: actionBusy ? '#86efac' : '#16a34a', color: 'white',
                  border: 'none', borderRadius: 9,
                  padding: '11px 28px', fontSize: 14, fontWeight: 700, cursor: actionBusy ? 'not-allowed' : 'pointer',
                  boxShadow: actionBusy ? 'none' : '0 3px 12px rgba(22,163,74,0.35)',
                  transition: 'all 0.15s',
                }}
                onMouseOver={e => !actionBusy && (e.currentTarget.style.background = '#15803d')}
                onMouseOut={e  => !actionBusy && (e.currentTarget.style.background = '#16a34a')}
              >
                {actionBusy ? '⏳ Sending to Fluent Case…' : '✓ Accept & Send to Fluent Case'}
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '18px 0', fontSize: 11, color: '#9ca3af' }}>
          Confidential — Attorney Work Product · For Internal Use Only · CaseTake · © {new Date().getFullYear()} Picnic Peaks LLC
        </div>

      </div>
    </div>
  )
}
