import { useState, useEffect } from 'react'

const CITIES = [
  { name: 'Taipei', flag: '🇹🇼', marketId: 4 },
  { name: 'Tokyo', flag: '🇯🇵', marketId: 5 },
  { name: 'Seoul', flag: '🇰🇷', marketId: 6 },
]

const ORACLE_BASE = '/api/oracle'

type WeatherData = {
  temperature: number
  sources?: { openweather?: number; weatherapi?: number; openmeteo?: number }
  sourceCount?: number
}

type City = typeof CITIES[number]

type MarketCardProps = {
  city: City
  weather: WeatherData | null | undefined
  oracleStatus: 'live' | 'offline' | 'loading'
  selectedOutcome: string | undefined
  secret: string
  onSelectOutcome: (outcome: string) => void
  onSecretChange: (secret: string) => void
  onPlaceBet: () => void
}

function MarketCard({
  city, weather, oracleStatus,
  selectedOutcome, secret,
  onSelectOutcome, onSecretChange, onPlaceBet,
}: MarketCardProps) {
  const getOutcome = (temp: number) => temp >= 28 ? 'HOT' : temp >= 20 ? 'MILD' : 'COLD'
  const w = weather

  return (
    <div className="card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Card Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '20px', fontWeight: 700 }}>{city.flag} {city.name}</div>
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

      {/* Temperature */}
      <div>
        <div style={{ fontSize: '48px', fontWeight: 700, color: 'rgba(155,89,245,1)', lineHeight: 1, letterSpacing: '-0.02em' }}>
          {w ? `${w.temperature.toFixed(1)}°C` : '--.-°C'}
        </div>
        {w?.sources && (
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px', lineHeight: 1.6 }}>
            OW: {w.sources.openweather?.toFixed(1) ?? '--'}°&nbsp;·&nbsp;
            WA: {w.sources.weatherapi?.toFixed(1) ?? '--'}°&nbsp;·&nbsp;
            OM: {w.sources.openmeteo?.toFixed(1) ?? '--'}°&nbsp;
            <span style={{ color: '#475569' }}>({w.sourceCount ?? 0}/3)</span>
          </div>
        )}
        {w && (
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
            Reading:{' '}
            <span style={{ color: 'rgba(155,89,245,0.9)', fontWeight: 600 }}>
              {getOutcome(w.temperature)} ({w.temperature >= 28 ? '≥28°C' : w.temperature >= 20 ? '20–28°C' : '<20°C'})
            </span>
          </div>
        )}
      </div>

      {/* Outcome Buttons */}
      <div>
        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '8px', letterSpacing: '0.1em' }}>
          SELECT YOUR OUTCOME
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { key: 'HOT', label: '🥵 HOT', sub: '≥28°C' },
            { key: 'MILD', label: '🌤 MILD', sub: '20–28°C' },
          ].map(({ key, label, sub }) => (
            <button key={key}
              onClick={() => onSelectOutcome(key)}
              style={{
                flex: 1, padding: '12px 8px',
                borderRadius: '10px',
                border: selectedOutcome === key
                  ? '2px solid rgba(155,89,245,1)'
                  : '1px solid rgba(155,89,245,0.2)',
                background: selectedOutcome === key
                  ? 'rgba(155,89,245,0.18)'
                  : 'rgba(155,89,245,0.05)',
                color: selectedOutcome === key ? 'rgba(155,89,245,1)' : '#94a3b8',
                fontFamily: 'JetBrains Mono, monospace',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '12px',
                transition: 'all 0.2s',
                textAlign: 'center',
              }}>
              <div>{label}</div>
              <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '2px' }}>{sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Secret Input */}
      <div>
        <label style={{ fontSize: '10px', color: '#64748b', display: 'block', marginBottom: '6px', letterSpacing: '0.08em' }}>
          🔐 USER SECRET (STAYS IN BROWSER)
        </label>
        <input
          type="password"
          placeholder="Enter your secret key..."
          value={secret}
          onChange={e => onSecretChange(e.target.value)}
          style={{
            width: '100%', padding: '10px 14px',
            background: 'rgba(155,89,245,0.05)',
            border: '1px solid rgba(155,89,245,0.2)',
            borderRadius: '8px',
            color: '#e4e1e9',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '13px',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={e => e.target.style.borderColor = 'rgba(155,89,245,0.6)'}
          onBlur={e => e.target.style.borderColor = 'rgba(155,89,245,0.2)'}
        />
        <div style={{ fontSize: '10px', color: '#475569', marginTop: '4px' }}>
          Poseidon2 commitment · never leaves your browser
        </div>
      </div>

      {/* Place Bet */}
      <button
        className="btn-primary"
        style={{ width: '100%', fontSize: '13px', padding: '12px', borderRadius: '8px' }}
        onClick={onPlaceBet}
      >
        Place Bet → Market #{city.marketId}
      </button>
    </div>
  )
}

export default function Markets() {
  const [weather, setWeather] = useState<Record<string, WeatherData | null>>({})
  const [oracleStatus, setOracleStatus] = useState<'live' | 'offline' | 'loading'>('loading')
  const [selectedOutcome, setSelectedOutcome] = useState<Record<string, string>>({})
  const [secrets, setSecrets] = useState<Record<string, string>>({})

  useEffect(() => {
    // Health check via Taipei weather fetch
    fetch(`${ORACLE_BASE}/oracle/weather/Taipei`)
      .then(r => r.json())
      .then(data => {
        if (data.temperature !== undefined) setOracleStatus('live')
        else setOracleStatus('offline')
      })
      .catch(() => setOracleStatus('offline'))

    // Fetch all cities simultaneously
    CITIES.forEach(city => {
      fetch(`${ORACLE_BASE}/oracle/weather/${city.name}`)
        .then(r => r.json())
        .then(data => setWeather(prev => ({ ...prev, [city.name]: data })))
        .catch(() => setWeather(prev => ({ ...prev, [city.name]: null })))
    })
  }, [])

  const handlePlaceBet = (city: City) => {
    const outcome = selectedOutcome[city.name]
    const secret = secrets[city.name]
    if (!outcome || !secret) {
      alert('Please select an outcome and enter a secret key.')
      return
    }
    const bet = {
      marketId: city.marketId,
      city: city.name,
      flag: city.flag,
      outcome,
      secret: secret.slice(0, 4) + '****',
      status: 'pending',
      timestamp: Date.now(),
    }
    const existing = JSON.parse(localStorage.getItem('midenBets') || '[]')
    localStorage.setItem('midenBets', JSON.stringify([...existing, bet]))
    alert(`Bet placed!\nMarket #${city.marketId} · ${city.name} · ${outcome}\nSecret committed locally.`)
  }

  return (
    <div style={{ padding: '40px 32px', maxWidth: '1100px', margin: '0 auto', position: 'relative' }}>
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

      {/* 2-column grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '24px',
        maxWidth: '1000px',
        margin: '0 auto',
      }}>
        {CITIES.map(city => (
          <MarketCard
            key={city.name}
            city={city}
            weather={weather[city.name]}
            oracleStatus={oracleStatus}
            selectedOutcome={selectedOutcome[city.name]}
            secret={secrets[city.name] || ''}
            onSelectOutcome={outcome => setSelectedOutcome(prev => ({ ...prev, [city.name]: outcome }))}
            onSecretChange={val => setSecrets(prev => ({ ...prev, [city.name]: val }))}
            onPlaceBet={() => handlePlaceBet(city)}
          />
        ))}
      </div>
    </div>
  )
}
