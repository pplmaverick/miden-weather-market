const STEPS = [
  {
    num: '01',
    icon: '🔑',
    color: 'rgba(155,89,245,1)',
    title: 'Enter Secret',
    desc: 'Generate a local secret value to mask your market position.',
  },
  {
    num: '02',
    icon: '⚡',
    color: '#41eec2',
    title: 'Poseidon2 Hash',
    desc: 'Compute a ZK-friendly hash of your bet and secret locally in the browser.',
  },
  {
    num: '03',
    icon: '🔗',
    color: 'rgba(155,89,245,1)',
    title: 'Commitment on Miden',
    desc: 'Send the hash to the Miden rollup. No one knows your bet yet.',
  },
  {
    num: '04',
    icon: '🌦',
    color: '#41eec2',
    title: 'Oracle Settles',
    desc: 'External weather data verified via 3 independent sources (median).',
  },
  {
    num: '05',
    icon: '✅',
    color: 'rgba(155,89,245,1)',
    title: 'Prove & Claim',
    desc: 'Generate a STARK proof showing your commitment wins. Claim instantly.',
  },
]

const FEATURES = [
  {
    icon: '🔒',
    title: 'Private Bets',
    desc: 'Your financial strategy remains your own. By hashing commitments locally, your market position is never revealed until the moment of claim.',
    tag: '● Local Hashing Active',
    tagColor: '#41eec2',
  },
  {
    icon: '⚡',
    title: 'ZK Native',
    desc: 'Built on Miden\'s STARK-based ZK execution engine. High throughput, lower fees, and cryptographically guaranteed settlement.',
    tags: ['STARK-PROOFED', 'MIDEN-CORE'],
  },
  {
    icon: '⛅',
    title: 'Real Oracle',
    desc: 'Settlement data is pulled from 3 independent meteorological sources, using a median calculation to ensure accuracy and prevent manipulation.',
    sources: ['SOURCE_A · OpenWeather', 'SOURCE_B · WeatherAPI', 'SOURCE_C · Open-Meteo'],
  },
]

export default function HowItWorks() {
  return (
    <div style={{ padding: '40px 32px', maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>
      {/* Ambient glows */}
      <div style={{ position: 'fixed', top: '-10%', left: '-10%', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(155,89,245,0.05) 0%, transparent 70%)', pointerEvents: 'none', zIndex: -1 }} />
      <div style={{ position: 'fixed', bottom: 0, right: 0, width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(65,238,194,0.03) 0%, transparent 70%)', pointerEvents: 'none', zIndex: -1 }} />

      {/* Hero */}
      <header style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto 64px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '6px 16px', borderRadius: '999px',
          border: '1px solid rgba(155,89,245,0.3)',
          background: 'rgba(155,89,245,0.05)',
          color: 'rgba(155,89,245,1)',
          fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em',
          marginBottom: '24px',
        }}>
          🛡 ZERO KNOWLEDGE PROOFS ENABLED
        </div>
        <h1 style={{
          fontSize: '36px', fontWeight: 700, color: '#e4e1e9',
          letterSpacing: '-0.02em', marginBottom: '16px',
          textShadow: '0 0 40px rgba(215,186,255,0.3)',
        }}>
          ZK-Native Prediction Market
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.7 }}>
          Miden Weather Market leverages Miden's actor-based ZK execution to allow for private commitments and trustless verification of weather outcomes.
        </p>
      </header>

      {/* Steps */}
      <section style={{ marginBottom: '64px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 600, color: '#e4e1e9', textAlign: 'center', marginBottom: '48px', letterSpacing: '-0.01em' }}>
          Lifecycle of a Bet
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '16px',
          position: 'relative',
        }}>
          {STEPS.map((step, i) => (
            <div key={step.num} style={{ position: 'relative' }}>
              <div className="card" style={{
                padding: '24px 20px',
                textAlign: 'center',
                cursor: 'default',
              }}>
                <div style={{
                  width: '56px', height: '56px', borderRadius: '12px',
                  background: 'rgba(155,89,245,0.1)',
                  border: '1px solid rgba(155,89,245,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '24px', margin: '0 auto 12px',
                }}>
                  {step.icon}
                </div>
                <div style={{ fontSize: '11px', color: step.color, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '6px' }}>
                  STEP {step.num}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#e4e1e9', marginBottom: '8px' }}>
                  {step.title}
                </div>
                <p style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.6 }}>
                  {step.desc}
                </p>
              </div>
              {/* Connector arrow (not last) */}
              {i < STEPS.length - 1 && (
                <div style={{
                  position: 'absolute', top: '50%', right: '-12px',
                  transform: 'translateY(-50%)',
                  color: 'rgba(155,89,245,0.4)', fontSize: '16px',
                  zIndex: 10,
                  display: 'none', // hidden on small screens, grid handles it
                }}>→</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Feature Cards */}
      <section style={{ marginBottom: '64px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          {FEATURES.map(f => (
            <div key={f.title} className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '36px', marginBottom: '16px' }}>{f.icon}</div>
              <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#e4e1e9', marginBottom: '12px', letterSpacing: '-0.01em' }}>
                {f.title}
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.7, flex: 1 }}>{f.desc}</p>
              <div style={{ marginTop: '20px' }}>
                {f.tag && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: f.tagColor, fontWeight: 700 }}>
                    <span className="pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: f.tagColor, display: 'inline-block' }} />
                    {f.tag.replace('● ', '')}
                  </div>
                )}
                {f.tags && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {f.tags.map(t => (
                      <span key={t} style={{
                        padding: '3px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                        background: 'rgba(155,89,245,0.1)', color: 'rgba(155,89,245,1)',
                        border: '1px solid rgba(155,89,245,0.2)',
                      }}>{t}</span>
                    ))}
                  </div>
                )}
                {f.sources && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {f.sources.map(s => (
                      <div key={s} style={{ fontSize: '10px', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                        {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Crypto Detail Section */}
      <section className="card" style={{ padding: '40px', borderRadius: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#e4e1e9', marginBottom: '24px' }}>
              Cryptographic Integrity
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {[
                {
                  icon: '💻',
                  title: 'Poseidon2 Permutation',
                  desc: 'Optimized for Miden\'s field arithmetic, ensuring 128-bit security for all commitments.',
                },
                {
                  icon: '🗂',
                  title: 'State Model',
                  desc: 'Using the Account State Model to handle individual bet commitments in parallel.',
                },
              ].map(({ icon, title, desc }) => (
                <div key={title} style={{ display: 'flex', gap: '16px' }}>
                  <span style={{ fontSize: '20px', flexShrink: 0, marginTop: '2px' }}>{icon}</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#e4e1e9', marginBottom: '4px' }}>{title}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.6 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <button style={{
              marginTop: '32px',
              border: '1px solid rgba(155,89,245,0.4)',
              color: 'rgba(155,89,245,1)',
              background: 'transparent',
              padding: '12px 28px',
              borderRadius: '999px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px',
              transition: 'background 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(155,89,245,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              onClick={() => window.open('https://github.com/pplmaverick/miden-weather-market', '_blank')}>
              View on GitHub →
            </button>
          </div>

          {/* Code Snippet */}
          <div style={{
            background: 'rgba(14,14,19,0.8)',
            border: '1px solid rgba(155,89,245,0.3)',
            borderRadius: '16px',
            padding: '28px',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '16px', letterSpacing: '0.08em' }}>
              // BetCommitment struct (Rust/Miden)
            </div>
            <pre style={{ fontSize: '13px', color: 'rgba(155,89,245,0.9)', lineHeight: 1.8, margin: 0 }}>{`struct BetCommitment {
  hash: Word,       // Poseidon2
  market_id: u64,
  outcome: u8,      // HOT=2 MILD=1
  nullifier: Word,  // prevent replay
}`}</pre>
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(75,68,84,0.3)' }}>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>COMMITMENT FORMULA</div>
              <code style={{
                fontSize: '12px',
                color: '#41eec2',
                background: 'rgba(65,238,194,0.05)',
                padding: '8px 12px',
                borderRadius: '6px',
                display: 'block',
              }}>
                H(secret ∥ market_id ∥ outcome)
              </code>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
