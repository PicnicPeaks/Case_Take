import { useState } from 'react'

const NAVY   = '#1a2e4a'
const GOLD   = '#f59e0b'
const GOLD2  = '#d97706'

// ── Tiny helpers ───────────────────────────────────────────────────────────────

function Btn({ href, onClick, primary, large, children, style = {} }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif",
    fontWeight: 700, textDecoration: 'none', cursor: 'pointer', border: 'none',
    borderRadius: large ? 12 : 9,
    padding: large ? '15px 34px' : '11px 24px',
    fontSize: large ? 16 : 14,
    transition: 'all 0.18s',
    ...style,
  }
  const colors = primary
    ? { background: GOLD, color: '#111' }
    : { background: 'rgba(255,255,255,0.1)', color: 'white', border: '1.5px solid rgba(255,255,255,0.25)' }
  const el = href
    ? <a href={href} style={{ ...base, ...colors }}>{children}</a>
    : <button onClick={onClick} style={{ ...base, ...colors }}>{children}</button>
  return el
}

function Tag({ children }) {
  return (
    <span style={{
      display: 'inline-block', background: `${GOLD}22`, color: GOLD2,
      border: `1px solid ${GOLD}44`, borderRadius: 20,
      padding: '4px 14px', fontSize: 12, fontWeight: 700,
      letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 18,
    }}>{children}</span>
  )
}

// ── Feature card ───────────────────────────────────────────────────────────────

function Feature({ icon, title, body }) {
  return (
    <div style={{
      background: 'white', borderRadius: 14,
      padding: '26px 24px',
      border: '1px solid #e5e7eb',
      boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
    }}>
      <div style={{ fontSize: 28, marginBottom: 14 }}>{icon}</div>
      <div style={{ fontWeight: 800, fontSize: 15, color: NAVY, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13.5, color: '#6b7280', lineHeight: 1.65 }}>{body}</div>
    </div>
  )
}

// ── Step ───────────────────────────────────────────────────────────────────────

function Step({ n, title, body }) {
  return (
    <div style={{ textAlign: 'center', flex: '1 1 220px', maxWidth: 280 }}>
      <div style={{
        width: 52, height: 52, borderRadius: 16, background: NAVY,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px', fontWeight: 900, fontSize: 20, color: GOLD,
      }}>{n}</div>
      <div style={{ fontWeight: 800, fontSize: 16, color: NAVY, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13.5, color: '#6b7280', lineHeight: 1.65 }}>{body}</div>
    </div>
  )
}

// ── Stat ───────────────────────────────────────────────────────────────────────

function Stat({ value, label }) {
  return (
    <div style={{ textAlign: 'center', padding: '0 24px' }}>
      <div style={{ fontWeight: 900, fontSize: 38, color: NAVY, letterSpacing: '-1.5px', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6, fontWeight: 500 }}>{label}</div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function MarketingPage() {
  const [showLogin, setShowLogin] = useState(false)
  const [firmInput, setFirmInput] = useState('')

  const handleFirmLogin = (e) => {
    e.preventDefault()
    const slug = firmInput.trim().toLowerCase()
    if (slug) window.location.href = `/?firm=${encodeURIComponent(slug)}&view=dashboard`
  }

  return (
    <div style={{ fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif", background: 'white', color: '#111827' }}>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes floatUp { from { opacity: 0; transform: translateY(24px) } to { opacity: 1; transform: translateY(0) } }
        .hero-in { animation: floatUp 0.7s ease both; }
        .hero-in-2 { animation: floatUp 0.7s 0.15s ease both; }
        .hero-in-3 { animation: floatUp 0.7s 0.3s ease both; }
        .feature-card:hover { transform: translateY(-3px); box-shadow: 0 8px 32px rgba(0,0,0,0.1) !important; transition: all 0.2s; }
        .demo-btn:hover { background: ${GOLD2} !important; transform: scale(1.03); }
        a { color: inherit; }
      `}</style>

      {/* ── Nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)',
        borderBottom: '1px solid #e5e7eb',
        padding: '0 clamp(20px,5vw,80px)', height: 62,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>⚖️</span>
          <span style={{ fontWeight: 900, fontSize: 18, color: NAVY, letterSpacing: '-0.5px' }}>CaseTake</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <a href="/?demo" style={{
            color: '#6b7280', fontWeight: 600, fontSize: 13.5, textDecoration: 'none',
            padding: '7px 16px', borderRadius: 8, transition: 'background 0.15s',
          }}
            onMouseOver={e => (e.target.style.background = '#f3f4f6')}
            onMouseOut={e => (e.target.style.background = 'transparent')}
          >Try Demo</a>
          {showLogin ? (
            <form onSubmit={handleFirmLogin} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                autoFocus
                value={firmInput}
                onChange={e => setFirmInput(e.target.value)}
                placeholder="your-firm-id"
                style={{
                  border: '1.5px solid #d1d5db', borderRadius: 8,
                  padding: '7px 12px', fontSize: 13, outline: 'none',
                  width: 148, color: '#111827',
                }}
                onFocus={e => (e.target.style.borderColor = NAVY)}
                onBlur={e  => (e.target.style.borderColor = '#d1d5db')}
              />
              <button type="submit" style={{
                background: NAVY, color: 'white', border: 'none',
                borderRadius: 8, padding: '8px 15px', fontSize: 13,
                fontWeight: 700, cursor: 'pointer',
              }}>Go →</button>
              <button type="button" onClick={() => { setShowLogin(false); setFirmInput('') }} style={{
                background: 'none', border: '1px solid #e5e7eb', borderRadius: 8,
                padding: '7px 10px', fontSize: 13, cursor: 'pointer', color: '#9ca3af',
              }}>✕</button>
            </form>
          ) : (
            <button onClick={() => setShowLogin(true)} style={{
              background: NAVY, color: 'white', fontWeight: 700, fontSize: 13,
              border: 'none', padding: '8px 18px', borderRadius: 8, cursor: 'pointer',
            }}>Firm Login</button>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        background: `linear-gradient(160deg, ${NAVY} 0%, #243d5e 55%, #1a3a5c 100%)`,
        padding: 'clamp(72px,12vw,120px) clamp(20px,5vw,80px)',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        {/* Background decoration */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.04,
          backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', maxWidth: 800, margin: '0 auto' }}>
          <div className="hero-in">
            <Tag>California Workers' Compensation</Tag>
          </div>
          <h1 className="hero-in-2" style={{
            margin: '0 0 22px', color: 'white', fontWeight: 900,
            fontSize: 'clamp(36px,6vw,64px)', lineHeight: 1.1, letterSpacing: '-2px',
          }}>
            Stop spending hours<br />
            <span style={{ color: GOLD }}>screening the wrong clients.</span>
          </h1>
          <p className="hero-in-3" style={{
            color: 'rgba(255,255,255,0.72)', fontSize: 'clamp(15px,2vw,19px)',
            lineHeight: 1.7, margin: '0 auto 40px', maxWidth: 580,
          }}>
            CaseTake qualifies workers' comp clients in under 10 minutes —
            AI-scored, red-flag-flagged, and synced to Fluent Case on approval.
            No intake calls. No wasted consults.
          </p>
          <div className="hero-in-3" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/?demo" className="demo-btn" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: GOLD, color: '#111', fontWeight: 800, fontSize: 16,
              textDecoration: 'none', padding: '16px 36px', borderRadius: 12,
              boxShadow: `0 4px 24px ${GOLD}66`,
            }}>
              ▶ Try the Demo
            </a>
            <a href="mailto:hello@picnicpeaks.com" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 700, fontSize: 15,
              textDecoration: 'none', padding: '16px 32px', borderRadius: 12,
              border: '1.5px solid rgba(255,255,255,0.25)',
            }}>
              Get a demo for your firm →
            </a>
          </div>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section style={{
        background: '#f8fafc', borderBottom: '1px solid #e5e7eb',
        padding: '40px clamp(20px,5vw,80px)',
      }}>
        <div style={{
          maxWidth: 900, margin: '0 auto',
          display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 28,
        }}>
          <Stat value="< 10 min" label="Average intake completion" />
          <Stat value="4 tiers"  label="Viability scoring: Strong → Declined" />
          <Stat value="2 langs"  label="English & Spanish, no extra setup" />
          <Stat value="1 click"  label="Accept → matter created in Fluent Case" />
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ padding: 'clamp(60px,8vw,100px) clamp(20px,5vw,80px)', textAlign: 'center' }}>
        <Tag>How it works</Tag>
        <h2 style={{ fontWeight: 900, fontSize: 'clamp(28px,4vw,42px)', color: NAVY, letterSpacing: '-1px', marginBottom: 12 }}>
          From inquiry to matter in minutes
        </h2>
        <p style={{ color: '#6b7280', fontSize: 15, marginBottom: 56, lineHeight: 1.65 }}>
          No phone tag. No 30-minute consultations for cases you'll decline anyway.
        </p>
        <div style={{ display: 'flex', gap: 40, justifyContent: 'center', flexWrap: 'wrap', maxWidth: 900, margin: '0 auto', position: 'relative' }}>
          <Step n="1"
            title="Client completes intake"
            body="A guided, conversational AI interview collects injury details, employment type, medical history, and jurisdiction — in English or Spanish." />
          <Step n="2"
            title="AI scores viability"
            body="Every intake gets a viability score (Strong / Moderate / Weak / Declined), red-flag analysis, and a full attorney-ready report. Instantly." />
          <Step n="3"
            title="One click to Fluent Case"
            body="Review the report, hit Accept, and the matter is created in Fluent Case automatically. Reject with a reason in two clicks." />
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ background: '#f8fafc', padding: 'clamp(60px,8vw,100px) clamp(20px,5vw,80px)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <Tag>Features</Tag>
            <h2 style={{ fontWeight: 900, fontSize: 'clamp(28px,4vw,42px)', color: NAVY, letterSpacing: '-1px' }}>
              Everything your firm needs
            </h2>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 20,
          }}>
            {[
              ['🤖', 'AI-Powered Intake', 'Conversational AI guides every client through a thorough, attorney-designed screening — no form fatigue, no missed fields.'],
              ['📊', 'Viability Scoring', 'Every case scores Strong, Moderate, Weak, or Declined based on injury details, employment type, jurisdiction, and legal timeline.'],
              ['🚩', 'Red Flag Detection', 'Automatic flags for missed deadlines, representation conflicts, jurisdiction issues, and low-merit patterns — before you spend a minute reviewing.'],
              ['🔗', 'Fluent Case Integration', 'Accept a case and a fully-populated matter appears in Fluent Case instantly. Applicant, employer, injury date, contact info — all mapped.'],
              ['🏢', 'White-Label for Your Firm', 'Your logo, your colors, your domain. Clients never see "CaseTake" — they see your brand from first click to confirmation.'],
              ['🌎', 'Bilingual by Default', 'Every question, every response, every report — available in English and Spanish. No extra configuration.'],
              ['📧', 'Instant Email Reports', 'Every completed intake triggers a branded email to your team with the full AI report and a one-click Accept / Reject link.'],
              ['⚡', 'Zero Phone Time', 'Clients complete intake on their own time from any device. Your team reviews reports async — no scheduling, no callbacks.'],
              ['🔒', 'Firm-Level Access Control', 'Password-protected dashboards and case views. Each firm gets their own isolated intake, dashboard, and settings.'],
            ].map(([icon, title, body]) => (
              <div key={title} className="feature-card" style={{ transition: 'all 0.2s' }}>
                <Feature icon={icon} title={title} body={body} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Fluent Case callout ── */}
      <section style={{
        background: NAVY, padding: 'clamp(60px,8vw,96px) clamp(20px,5vw,80px)',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>🔗</div>
          <h2 style={{ fontWeight: 900, fontSize: 'clamp(26px,4vw,38px)', color: 'white', letterSpacing: '-1px', marginBottom: 16 }}>
            Built for Fluent Case users
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, lineHeight: 1.7, marginBottom: 36 }}>
            Accept an intake and a fully-structured matter is created in Fluent Case automatically —
            applicant contact, employer, date of injury, case type. No copy-paste, no data entry.
            Just a great new client file, ready to go.
          </p>
          <div style={{
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 14, padding: '20px 28px', display: 'inline-block', textAlign: 'left', maxWidth: 420,
          }}>
            {[
              ['✅', 'Applicant name + contact'],
              ['✅', 'Employer name'],
              ['✅', 'Date of injury'],
              ['✅', 'Case type: workers-compensation'],
              ['✅', 'Matter created instantly on Accept'],
            ].map(([check, text]) => (
              <div key={text} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>
                <span>{check}</span><span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Demo CTA ── */}
      <section style={{
        padding: 'clamp(72px,10vw,112px) clamp(20px,5vw,80px)',
        textAlign: 'center', background: 'white',
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <Tag>See it live</Tag>
          <h2 style={{ fontWeight: 900, fontSize: 'clamp(28px,4vw,44px)', color: NAVY, letterSpacing: '-1px', marginBottom: 16 }}>
            Try it yourself — right now
          </h2>
          <p style={{ color: '#6b7280', fontSize: 16, lineHeight: 1.7, marginBottom: 40 }}>
            Go through a full intake as if you were a client. At the end you'll see the exact
            report your attorney receives — viability score, red flags, full case summary,
            and the one-click Fluent Case integration.
          </p>
          <a href="/?demo" className="demo-btn" style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: GOLD, color: '#111', fontWeight: 800, fontSize: 18,
            textDecoration: 'none', padding: '18px 44px', borderRadius: 14,
            boxShadow: `0 6px 32px ${GOLD}55`,
          }}>
            ▶ Start the Demo
          </a>
          <p style={{ marginTop: 18, fontSize: 13, color: '#9ca3af' }}>
            No sign-up. No credit card. Just the real thing.
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        background: NAVY, padding: '32px clamp(20px,5vw,80px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>⚖️</span>
          <span style={{ color: 'white', fontWeight: 800, fontSize: 15 }}>CaseTake</span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginLeft: 8 }}>
            by Picnic Peaks LLC
          </span>
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <a href="/?demo" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, textDecoration: 'none', fontWeight: 500 }}>Try Demo</a>
          <a href="mailto:hello@picnicpeaks.com" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, textDecoration: 'none', fontWeight: 500 }}>Contact</a>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>
          © {new Date().getFullYear()} Picnic Peaks LLC
        </div>
      </footer>
    </div>
  )
}
