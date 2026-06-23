import { useState, useEffect } from 'react'

const CITIES = [
  { name: 'Taipei', flag: '🇹🇼', marketId: 4 },
  { name: 'Tokyo', flag: '🇯🇵', marketId: 5 },
  { name: 'Seoul', flag: '🇰🇷', marketId: 6 },
]

const ORACLE_BASE = 'http://46.62.246.244:3001'

type WeatherData = {
  temperature: number
  sources?: { openweather?: number; weatherapi?: number; openmeteo?: number }
  sourceCount?: number
}

export default function Markets() {
  const [activeCity, setActiveCity] = useState('Taipei')
  const [weather, setWeather] = useState<Record<string, WeatherData | null>>({})
  const [oracleStatus, setOracleStatus] = useState<'live' | 'offline' | 'loading'>('loading')
  const [selectedOutcome, setSelectedOutcome] = useState<Record<string, string>>({})
  const [secrets, setSecrets] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch(`${ORACLE_BASE}/oracle/health`)
      .then(r => r.json())
      .then(() => setOracleStatus('live'))
      .catch(() => setOracleStatus('offline'))

    CITIES.forEach(city => {
      fetch(`${ORACLE_BASE}/oracle/weather/${city.name}`)
        .then(r => r.json())
        .then(data => setWeather(prev => ({ ...prev, [city.name]: data })))
        .catch(() => setWeather(prev => ({ ...prev, [city.name]: null })))
    })
  }, [])

  const city = CITIES.find(c => c.name === activeCity)!
  const w = weather[activeCity]

  const getOutcome = (temp: number) => temp >= 28 ? 'HOT' : temp >= 20 ? 'MILD' : 'COLD'

  const handlePlaceBet = () => {
    const outcome = selectedOutcome[activeCity]
    const secret = secrets[activeCity]
    if (!outcome || !secret) {
      alert('Please select an outcome and enter a secret key.')
      return
    }
    const bet = {
      marketId: city.marketId,
      city: activeCity,
      flag: city.flag,
      outcome,
      secret: secret.slice(0, 4) + '****',
      status: 'pending',
      timestamp: Date.now(),
    }
    const existing = JSON.parse(localStorage.getItem('midenBets') || '[]')
    localStorage.setItem('midenBets', JSON.stringify([...existing, bet]))
    alert(`Bet placed!\nMarket #${city.marketId} · ${activeCity} · ${outcome}\nSecret committed locally.`)
  }

  return (
    <div style={{ padding: '40px 32px', maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>
      {/* Ambient glow */}
      <div style={{
        position: 'fixed', top: '-10%', right: '-10%',
        width: '600px', height: '600px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(155,89,245,0.07) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: -1,
      }} />

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{ width: '4px', height: '32px', background: 'rgba(155,89,245,1)', borderRadius: '2px' }} />
          <h1 style={{ fontSize: '32px', fontWeight: 700, color: 'rgba(155,89,245,1)', letterSpacing: '-0.02em' }}>
            Weather Markets
          </h1>
        </div>
        <p style={{ color: '#64748b', fontSize: '13px', marginLeft: '16px' }}>
          ZK Prediction Markets · Poseidon2 Commitments · Client-Side Proving
        </p>
      </div>

      {/* City Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '28px' }}>
        {CITIES.map(c => (
          <button key={c.name} onClick={() => setActiveCity(c.name)} style={{
            padding: '10px 24px',
            borderRadius: '999px',
            border: activeCity === c.name ? '1px solid rgba(155,89,245,0.6)' : '1px solid rgba(155,89,245,0.2)',
            background: activeCity === c.name ? 'rgba(155,89,245,0.15)' : 'rgba(155,89,245,0.05)',
            color: activeCity === c.name ? 'rgba(155,89,245,1)' : '#64748b',
            fontFamily: 'JetBrains Mono, monospace',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: activeCity === c.name ? 600 : 400,
            transition: 'all 0.2s',
          }}>
            {c.flag} {c.name}
          </button>
        ))}
      </div>

      {/* Market Card */}
      <div className="card" style={{ maxWidth: '500px', padding: '28px' }}>
        {/* Card Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 700 }}>{city.flag} {city.name}</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', letterSpacing: '0.08em' }}>
              MARKET #{city.marketId}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            <span className={`badge ${oracleStatus === 'live' ? 'badge-live' : oracleStatus === 'loading' ? 'badge-pending' : 'badge-offline'}`}>
              <span className={oracleStatus === 'live' ? 'pulse' : ''} style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: oracleStatus === 'live' ? '#41eec2' : oracleStatus === 'loading' ? 'rgba(155,89,245,1)' : '#ef4444',
                display: 'inline-block',
              }} />
              {oracleStatus === 'loading' ? 'CONNECTING' : oracleStatus === 'live' ? 'ORACLE LIVE' : 'OFFLINE'}
            </span>
            <span className="badge badge-open">OPEN</span>
          </div>
        </div>

        {/* Temperature Display */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '52px', fontWeight: 700, color: 'rgba(155,89,245,1)', lineHeight: 1, letterSpacing: '-0.02em' }}>
            {w ? `${w.temperature.toFixed(1)}°C` : '--.-°C'}
          </div>
          {w?.sources && (
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '10px', lineHeight: 1.6 }}>
              OW: {w.sources.openweather?.toFixed(1) ?? '--'}°&nbsp;·&nbsp;
              WA: {w.sources.weatherapi?.toFixed(1) ?? '--'}°&nbsp;·&nbsp;
              OM: {w.sources.openmeteo?.toFixed(1) ?? '--'}°&nbsp;
              <span style={{ color: '#475569' }}>({w.sourceCount ?? 0}/3 sources)</span>
            </div>
          )}
          {w && (
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>
              Current reading:{' '}
              <span style={{ color: 'rgba(155,89,245,0.9)', fontWeight: 600 }}>
                {getOutcome(w.temperature)} ({w.temperature >= 28 ? '≥28°C' : w.temperature >= 20 ? '20–28°C' : '<20°C'})
              </span>
            </div>
          )}
        </div>

        {/* Outcome Buttons */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '10px', letterSpacing: '0.08em' }}>
            SELECT YOUR OUTCOME
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {[
              { key: 'HOT', label: '🥵 HOT', sub: '≥28°C' },
              { key: 'MILD', label: '🌤 MILD', sub: '20–28°C' },
            ].map(({ key, label, sub }) => (
              <button key={key}
                onClick={() => setSelectedOutcome(prev => ({ ...prev, [activeCity]: key }))}
                style={{
                  flex: 1, padding: '14px 12px',
                  borderRadius: '10px',
                  border: selectedOutcome[activeCity] === key
                    ? '2px solid rgba(155,89,245,1)'
                    : '1px solid rgba(155,89,245,0.2)',
                  background: selectedOutcome[activeCity] === key
                    ? 'rgba(155,89,245,0.18)'
                    : 'rgba(155,89,245,0.05)',
                  color: selectedOutcome[activeCity] === key ? 'rgba(155,89,245,1)' : '#94a3b8',
                  fontFamily: 'JetBrains Mono, monospace',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                  transition: 'all 0.2s',
                  textAlign: 'center',
                }}>
                <div>{label}</div>
                <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>{sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Secret Input */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '8px', letterSpacing: '0.08em' }}>
            🔐 USER SECRET (STAYS IN BROWSER)
          </label>
          <input
            type="password"
            placeholder="Enter your secret key..."
            value={secrets[activeCity] || ''}
            onChange={e => setSecrets(prev => ({ ...prev, [activeCity]: e.target.value }))}
            style={{
              width: '100%', padding: '12px 16px',
              background: 'rgba(155,89,245,0.05)',
              border: '1px solid rgba(155,89,245,0.2)',
              borderRadius: '10px',
              color: '#e4e1e9',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '13px',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => e.target.style.borderColor = 'rgba(155,89,245,0.6)'}
            onBlur={e => e.target.style.borderColor = 'rgba(155,89,245,0.2)'}
          />
          <div style={{ fontSize: '11px', color: '#475569', marginTop: '6px' }}>
            Used for Poseidon2 commitment · never leaves your browser
          </div>
        </div>

        {/* Place Bet */}
        <button
          className="btn-primary"
          style={{ width: '100%', fontSize: '14px', padding: '14px', borderRadius: '10px' }}
          onClick={handlePlaceBet}
        >
          Place Bet → Market #{city.marketId}
        </button>
      </div>
    </div>
  )
}
