import { useState, useEffect, type CSSProperties } from 'react'
import { useWallet } from '@miden-sdk/miden-wallet-adapter'

// v7 contract on Miden testnet v0.15
const CONTRACT_ID = '0x72df3f2c728125716878e6af1422af'

// market_id=0 was the v7 e2e test market (settled 2026-06-29).
// Week 5 production markets were created after that, starting from market_count=1.
const CITIES = [
  { name: 'Taipei', flag: '🇹🇼', marketId: 1, threshold: 32.0, unit: '32.0' },
  { name: 'Tokyo',  flag: '🇯🇵', marketId: 2, threshold: 27.0, unit: '27.0' },
  { name: 'Seoul',  flag: '🇰🇷', marketId: 3, threshold: 27.0, unit: '27.0' },
]

const ORACLE_BASE = '/api/oracle'

type WeatherData = {
  temperature: number
  sources?: { openweather?: number; weatherapi?: number; openmeteo?: number }
  sourceCount?: number
}

type BetOutcome = 0 | 1  // 0 = YES (above threshold), 1 = NO (at/below threshold)

type BetState = {
  outcome: BetOutcome | null
  amount: string
  secret: string
  status: 'idle' | 'computing' | 'ready' | 'error'
  commitment?: string
  cliCommand?: string
  errorMsg?: string
}

type City = typeof CITIES[number]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select the text manually
    }
  }
  return (
    <button
      onClick={handleCopy}
      style={{
        padding: '4px 10px', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace',
        background: copied ? 'rgba(65,238,194,0.2)' : 'rgba(155,89,245,0.15)',
        border: `1px solid ${copied ? 'rgba(65,238,194,0.5)' : 'rgba(155,89,245,0.3)'}`,
        borderRadius: '4px', color: copied ? '#41eec2' : 'rgba(155,89,245,1)',
        cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
      }}
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

function MarketCard({
  city,
  weather,
  oracleStatus,
  betState,
  walletAddress,
  onBetStateChange,
}: {
  city: City
  weather: WeatherData | null | undefined
  oracleStatus: 'live' | 'offline' | 'loading'
  betState: BetState
  walletAddress: string | null
  onBetStateChange: (s: BetState) => void
}) {
  const temp = weather?.temperature
  const isAbove = temp !== undefined ? temp > city.threshold : null

  const handlePlaceBet = async () => {
    if (!walletAddress) {
      alert('Please connect your Miden Wallet first.')
      return
    }
    if (betState.outcome === null) {
      alert('Please select YES or NO.')
      return
    }
    if (!betState.secret.trim()) {
      alert('Please enter a user secret (any number).')
      return
    }
    const amount = parseInt(betState.amount) || 100
    const userSecret = parseInt(betState.secret)
    if (isNaN(userSecret)) {
      alert('User secret must be a number.')
      return
    }

    onBetStateChange({ ...betState, status: 'computing' })

    try {
      // Compute Poseidon2 commitment in browser WASM (chain-agnostic, no RPC needed)
      const sdk = await import('@miden-sdk/miden-sdk')
      await sdk.MidenClient.createMock()
      const wasm = await sdk.getWasmOrThrow()

      const felts = new wasm.FeltArray([
        new wasm.Felt(BigInt(city.marketId)),
        new wasm.Felt(BigInt(betState.outcome)),
        new wasm.Felt(BigInt(amount)),
        new wasm.Felt(BigInt(userSecret)),
      ])
      const digest = wasm.Poseidon2.hashElements(felts)
      const bc = digest.toU64s()
      const commitment = `[${bc[0]}, ${bc[1]}, ${bc[2]}, ${bc[3]}]`

      // Pre-build the exact CLI command with all values filled in
      const cliCommand =
        `cd ~/miden-weather-market && ` +
        `./tools/submit-place-bet/target/release/submit-place-bet ` +
        `${city.marketId} ${betState.outcome} ${amount} ${userSecret}`

      // Save pending bet to localStorage (for My Bets page)
      const bet = {
        marketId: city.marketId,
        city: city.name,
        flag: city.flag,
        outcome: betState.outcome === 0 ? 'YES' : 'NO',
        secret: userSecret,
        status: 'pending_cli',
        commitment,
        timestamp: Date.now(),
      }
      const existing = JSON.parse(localStorage.getItem('midenBets') || '[]')
      localStorage.setItem('midenBets', JSON.stringify([...existing, bet]))

      onBetStateChange({ ...betState, status: 'ready', commitment, cliCommand })
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e)
      console.error('[commitment] WASM error:', e)
      onBetStateChange({ ...betState, status: 'error', errorMsg: err })
    }
  }

  const amount = parseInt(betState.amount) || 100
  const userSecret = betState.secret.trim() ? parseInt(betState.secret) || 0 : 0

  return (
    <div className="card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '20px', fontWeight: 700 }}>{city.flag} {city.name}</div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', letterSpacing: '0.08em' }}>
            MARKET #{city.marketId} · &gt; {city.unit}°C?
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <span className={`badge ${oracleStatus === 'live' ? 'badge-live' : oracleStatus === 'loading' ? 'badge-pending' : 'badge-offline'}`}>
            <span style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: oracleStatus === 'live' ? '#41eec2' : oracleStatus === 'loading' ? 'rgba(155,89,245,1)' : '#ef4444',
              display: 'inline-block',
            }} className={oracleStatus === 'live' ? 'pulse' : ''} />
            {oracleStatus === 'loading' ? 'CONNECTING' : oracleStatus === 'live' ? 'ORACLE LIVE' : 'OFFLINE'}
          </span>
          <span className="badge badge-open">OPEN</span>
        </div>
      </div>

      {/* Temperature */}
      <div>
        <div style={{ fontSize: '48px', fontWeight: 700, color: 'rgba(155,89,245,1)', lineHeight: 1, letterSpacing: '-0.02em' }}>
          {temp !== undefined ? `${temp.toFixed(1)}°C` : '--.-°C'}
        </div>
        {weather?.sources && (
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px', lineHeight: 1.6 }}>
            OW: {weather.sources.openweather?.toFixed(1) ?? '--'}°&nbsp;·&nbsp;
            WA: {weather.sources.weatherapi?.toFixed(1) ?? '--'}°&nbsp;·&nbsp;
            OM: {weather.sources.openmeteo?.toFixed(1) ?? '--'}°
          </div>
        )}
        {temp !== undefined && (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <span style={{ color: '#64748b' }}>Current reading: </span>
            <span style={{ color: isAbove ? '#41eec2' : '#ef4444', fontWeight: 600 }}>
              {isAbove ? `YES — above ${city.unit}°C` : `NO — at/below ${city.unit}°C`}
            </span>
          </div>
        )}
      </div>

      {/* YES / NO buttons */}
      <div>
        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '8px', letterSpacing: '0.1em' }}>
          TEMPERATURE &gt; {city.unit}°C?
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {([
            { key: 0 as BetOutcome, label: 'YES', emoji: '🌡', hint: `above ${city.unit}°C` },
            { key: 1 as BetOutcome, label: 'NO',  emoji: '❄️', hint: `at/below ${city.unit}°C` },
          ] as const).map(({ key, label, emoji, hint }) => (
            <button
              key={key}
              onClick={() => onBetStateChange({ ...betState, outcome: key, status: 'idle' })}
              style={{
                flex: 1, padding: '14px 8px',
                borderRadius: '10px',
                border: betState.outcome === key
                  ? '2px solid rgba(155,89,245,1)'
                  : '1px solid rgba(155,89,245,0.2)',
                background: betState.outcome === key
                  ? 'rgba(155,89,245,0.18)'
                  : 'rgba(155,89,245,0.04)',
                color: betState.outcome === key ? 'rgba(155,89,245,1)' : '#94a3b8',
                fontFamily: 'JetBrains Mono, monospace',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '14px',
                transition: 'all 0.2s',
                textAlign: 'center',
              }}
            >
              <div>{emoji} {label}</div>
              <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '3px', fontWeight: 400 }}>{hint}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Amount + Secret */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '10px', color: '#64748b', display: 'block', marginBottom: '5px', letterSpacing: '0.08em' }}>
            AMOUNT
          </label>
          <input
            type="number"
            min="1"
            placeholder="100"
            value={betState.amount}
            onChange={e => onBetStateChange({ ...betState, amount: e.target.value, status: 'idle' })}
            style={inputStyle}
            onFocus={e => e.target.style.borderColor = 'rgba(155,89,245,0.6)'}
            onBlur={e => e.target.style.borderColor = 'rgba(155,89,245,0.2)'}
          />
        </div>
        <div style={{ flex: 2 }}>
          <label style={{ fontSize: '10px', color: '#64748b', display: 'block', marginBottom: '5px', letterSpacing: '0.08em' }}>
            🔐 USER SECRET (any number)
          </label>
          <input
            type="number"
            placeholder="e.g. 42"
            value={betState.secret}
            onChange={e => onBetStateChange({ ...betState, secret: e.target.value, status: 'idle' })}
            style={inputStyle}
            onFocus={e => e.target.style.borderColor = 'rgba(155,89,245,0.6)'}
            onBlur={e => e.target.style.borderColor = 'rgba(155,89,245,0.2)'}
          />
        </div>
      </div>
      <div style={{ fontSize: '10px', color: '#475569', marginTop: '-12px' }}>
        Poseidon2(market_id, outcome, amount, secret) · computed locally, never transmitted
      </div>

      {/* CLI ready state */}
      {betState.status === 'ready' && betState.cliCommand && (
        <div style={{
          borderRadius: '10px',
          border: '1px solid rgba(65,238,194,0.25)',
          background: 'rgba(65,238,194,0.05)',
          padding: '14px 16px',
          display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>✓</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#41eec2', fontFamily: 'JetBrains Mono, monospace' }}>
              ZK Commitment Ready
            </span>
          </div>

          {/* Commitment */}
          <div style={{ fontSize: '10px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
            <span style={{ color: '#475569' }}>Poseidon2: </span>
            <span style={{ color: '#94a3b8', wordBreak: 'break-all' }}>{betState.commitment}</span>
          </div>

          {/* Explanation */}
          <div style={{
            fontSize: '10px', color: '#64748b', lineHeight: 1.6,
            padding: '8px 10px',
            background: 'rgba(0,0,0,0.2)', borderRadius: '6px',
            borderLeft: '2px solid rgba(155,89,245,0.4)',
          }}>
            Browser wallet → contract calls require the wallet to hold the contract's MAST code,
            which Miden v0.15 does not yet support. This is an SDK-level limitation, not an app bug.
            Submit the transaction below via the Miden CLI to complete your bet on-chain.
          </div>

          {/* CLI command */}
          <div>
            <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '6px', letterSpacing: '0.08em' }}>
              SUBMIT VIA MIDEN CLI:
            </div>
            <div style={{
              background: 'rgba(0,0,0,0.5)', borderRadius: '6px', padding: '10px 12px',
              fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#e4e1e9',
              overflowX: 'auto', whiteSpace: 'pre', position: 'relative',
            }}>
              {betState.cliCommand}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
              <CopyButton text={betState.cliCommand} />
            </div>
          </div>

          {/* Outcome reminder */}
          <div style={{ fontSize: '10px', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
            outcome {betState.outcome === 0 ? '0 = YES' : '1 = NO'} ·
            amount {amount} ·
            secret {userSecret} ← save this for claim-winnings
          </div>
        </div>
      )}

      {betState.status === 'error' && (
        <div style={{
          padding: '12px 14px', borderRadius: '8px',
          border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)',
          fontSize: '12px', color: '#ef4444', fontFamily: 'JetBrains Mono, monospace',
        }}>
          ✗ WASM error: {betState.errorMsg?.slice(0, 120)}
        </div>
      )}

      {/* Place Bet button */}
      <button
        className="btn-primary"
        style={{
          width: '100%', fontSize: '13px', padding: '13px', borderRadius: '8px',
          opacity: betState.status === 'computing' ? 0.6 : 1,
        }}
        onClick={handlePlaceBet}
        disabled={betState.status === 'computing'}
      >
        {betState.status === 'computing'
          ? 'Computing ZK Commitment...'
          : betState.status === 'ready'
          ? '↻ Recompute'
          : `Generate CLI Command → Market #${city.marketId}`}
      </button>
    </div>
  )
}

const inputStyle: CSSProperties = {
  width: '100%', padding: '9px 12px',
  background: 'rgba(155,89,245,0.05)',
  border: '1px solid rgba(155,89,245,0.2)',
  borderRadius: '8px',
  color: '#e4e1e9',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: '13px',
  outline: 'none',
  transition: 'border-color 0.2s',
}

export default function Markets() {
  const { connected, address } = useWallet()
  const [weather, setWeather] = useState<Record<string, WeatherData | null>>({})
  const [oracleStatus, setOracleStatus] = useState<'live' | 'offline' | 'loading'>('loading')
  const [betStates, setBetStates] = useState<Record<string, BetState>>(
    Object.fromEntries(CITIES.map(c => [c.name, { outcome: null, amount: '100', secret: '', status: 'idle' }]))
  )

  useEffect(() => {
    fetch(`${ORACLE_BASE}/oracle/weather/Taipei`)
      .then(r => r.json())
      .then(data => setOracleStatus(data.temperature !== undefined ? 'live' : 'offline'))
      .catch(() => setOracleStatus('offline'))

    CITIES.forEach(city => {
      fetch(`${ORACLE_BASE}/oracle/weather/${city.name}`)
        .then(r => r.json())
        .then(data => setWeather(prev => ({ ...prev, [city.name]: data })))
        .catch(() => setWeather(prev => ({ ...prev, [city.name]: null })))
    })
  }, [])

  return (
    <div style={{ padding: '40px 32px', maxWidth: '1100px', margin: '0 auto', position: 'relative' }}>
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
          ZK Prediction Markets · Poseidon2 Commitments · Miden Testnet v0.15
        </p>

        {!connected && (
          <div style={{
            marginLeft: '16px', marginTop: '12px',
            padding: '10px 16px', borderRadius: '8px',
            border: '1px solid rgba(155,89,245,0.3)',
            background: 'rgba(155,89,245,0.06)',
            fontSize: '12px', color: '#94a3b8',
            display: 'inline-flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{ color: '#f59e0b' }}>⚠</span>
            Connect your Miden Wallet (top-right) to associate your account with the bet
          </div>
        )}
        {connected && (
          <div style={{
            marginLeft: '16px', marginTop: '12px',
            padding: '10px 16px', borderRadius: '8px',
            border: '1px solid rgba(65,238,194,0.3)',
            background: 'rgba(65,238,194,0.06)',
            fontSize: '12px', color: '#41eec2',
            display: 'inline-flex', alignItems: 'center', gap: '8px',
          }}>
            <span className="pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: '#41eec2', display: 'inline-block' }} />
            Connected: {address}
          </div>
        )}
      </div>

      {/* Market cards grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '24px',
        maxWidth: '1050px',
        margin: '0 auto',
      }}>
        {CITIES.map(city => (
          <MarketCard
            key={city.name}
            city={city}
            weather={weather[city.name]}
            oracleStatus={oracleStatus}
            betState={betStates[city.name]}
            walletAddress={address}
            onBetStateChange={s => setBetStates(prev => ({ ...prev, [city.name]: s }))}
          />
        ))}
      </div>

      {/* Contract info footer */}
      <div style={{
        marginTop: '40px', padding: '16px 20px',
        border: '1px solid rgba(155,89,245,0.15)',
        borderRadius: '8px', background: 'rgba(155,89,245,0.04)',
        fontSize: '11px', color: '#475569',
        display: 'flex', flexWrap: 'wrap', gap: '16px',
      }}>
        <span>Contract: <span style={{ color: '#64748b' }}>{CONTRACT_ID}</span></span>
        <span>·</span>
        <span>Outcomes: <span style={{ color: '#64748b' }}>binary (0=YES, 1=NO)</span></span>
        <span>·</span>
        <span>Close: <span style={{ color: '#64748b' }}>+24h from creation</span></span>
        <span>·</span>
        <span>Hash: <span style={{ color: '#64748b' }}>Poseidon2</span></span>
        <span>·</span>
        <span>Submit: <span style={{ color: '#64748b' }}>Miden CLI</span></span>
      </div>
    </div>
  )
}
