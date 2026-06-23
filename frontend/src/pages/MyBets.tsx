import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

type Bet = {
  marketId: number
  city: string
  flag: string
  outcome: string
  secret: string
  status: 'pending' | 'claimable' | 'claimed' | 'lost'
  timestamp: number
}

export default function MyBets() {
  const [bets, setBets] = useState<Bet[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('midenBets') || '[]')
    setBets(stored)
  }, [])

  const handleClaim = (index: number) => {
    alert(`Generating ZK proof for bet #${index + 1}...\n\nThis would call submit-claim-winnings on Miden testnet.`)
    const updated = [...bets]
    updated[index] = { ...updated[index], status: 'claimed' }
    setBets(updated)
    localStorage.setItem('midenBets', JSON.stringify(updated))
  }

  const statusBadge = (status: Bet['status']) => {
    switch (status) {
      case 'claimable': return <span className="badge badge-claimable"><span className="pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: '#41eec2', display: 'inline-block' }} />CLAIMABLE</span>
      case 'pending': return <span className="badge badge-pending"><span className="pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(155,89,245,1)', display: 'inline-block' }} />PENDING</span>
      case 'claimed': return <span className="badge badge-claimed">✓ CLAIMED</span>
      case 'lost': return <span className="badge badge-lost">LOST</span>
    }
  }

  return (
    <div style={{ padding: '40px 32px', maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>
      {/* Ambient glows */}
      <div style={{ position: 'fixed', top: '-10%', right: '-10%', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(155,89,245,0.07) 0%, transparent 70%)', pointerEvents: 'none', zIndex: -1 }} />
      <div style={{ position: 'fixed', bottom: '-5%', left: '-5%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(65,238,194,0.04) 0%, transparent 70%)', pointerEvents: 'none', zIndex: -1 }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px', flexWrap: 'wrap', gap: '24px' }}>
        <div>
          <h1 style={{ fontSize: '36px', fontWeight: 700, color: '#e4e1e9', letterSpacing: '-0.02em', marginBottom: '8px' }}>
            Your ZK Bets
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px' }}>
            Manage your cryptographic weather positions. Secrets never leave your browser.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div className="card" style={{ padding: '16px 24px', minWidth: '140px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', letterSpacing: '0.1em', marginBottom: '4px' }}>TOTAL BETS</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'rgba(155,89,245,1)' }}>{bets.length}</div>
          </div>
          <div className="card" style={{ padding: '16px 24px', minWidth: '140px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', letterSpacing: '0.1em', marginBottom: '4px' }}>PENDING</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#41eec2' }}>
              {bets.filter(b => b.status === 'pending').length}
            </div>
          </div>
        </div>
      </div>

      {bets.length === 0 ? (
        /* Empty State */
        <div style={{ marginTop: '48px', padding: '80px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
          className="card">
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            background: 'rgba(155,89,245,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '32px', marginBottom: '24px',
          }}>
            🔐
          </div>
          <h3 style={{ fontSize: '24px', fontWeight: 700, color: '#e4e1e9', marginBottom: '8px' }}>No bets yet</h3>
          <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', maxWidth: '360px', lineHeight: 1.6 }}>
            Your secrets, your bets. Start trading weather derivatives with zero-knowledge privacy.
          </p>
          <button className="btn-primary" style={{ marginTop: '32px', padding: '12px 32px' }}
            onClick={() => navigate('/')}>
            Explore Markets
          </button>
        </div>
      ) : (
        /* Bets Table */
        <div style={{
          background: 'rgba(155,89,245,0.06)',
          border: '1px solid rgba(155,89,245,0.2)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'JetBrains Mono, monospace' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}>
                  {['Market', 'City', 'Outcome', 'Secret (ZK)', 'Status', 'Action'].map((h, i) => (
                    <th key={h} style={{
                      padding: '16px 24px',
                      fontSize: '11px', fontWeight: 700, color: '#64748b',
                      letterSpacing: '0.1em', textAlign: i === 5 ? 'right' : 'left',
                    }}>
                      {h.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bets.map((bet, i) => (
                  <tr key={i} className="glass-row" style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    opacity: bet.status === 'lost' ? 0.55 : 1,
                  }}>
                    <td style={{ padding: '20px 24px' }}>
                      <div style={{ fontSize: '13px', color: '#e4e1e9', fontWeight: 600 }}>MARKET #{bet.marketId}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        {new Date(bet.timestamp).toLocaleDateString()}
                      </div>
                    </td>
                    <td style={{ padding: '20px 24px', fontSize: '13px', color: '#e4e1e9' }}>
                      {bet.flag} {bet.city}
                    </td>
                    <td style={{ padding: '20px 24px' }}>
                      <span style={{
                        fontSize: '13px', fontWeight: 700,
                        color: bet.status === 'lost' ? '#ef4444' : '#41eec2',
                      }}>
                        {bet.outcome}
                      </span>
                    </td>
                    <td style={{ padding: '20px 24px', fontSize: '13px', color: '#64748b' }}>
                      {bet.secret}
                    </td>
                    <td style={{ padding: '20px 24px' }}>
                      {statusBadge(bet.status)}
                    </td>
                    <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                      {bet.status === 'claimable' ? (
                        <button className="btn-teal" onClick={() => handleClaim(i)}>
                          Claim Winnings
                        </button>
                      ) : bet.status === 'pending' ? (
                        <button className="btn-ghost">Wait for Proof</button>
                      ) : bet.status === 'claimed' ? (
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Tx: 0x...ZK</span>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Resolved</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginTop: '48px' }}>
        {[
          { icon: '🛡', title: 'Privacy Protocol', desc: 'All bets are masked using Miden\'s Note system. Your outcome and stake are encrypted; only the final ZK-proof reveals claimability.' },
          { icon: '⚡', title: 'Instant Settlement', desc: 'Once weather stations push data to the oracle, the platform generates a proof for each city. Winnings are available immediately.' },
          { icon: '📊', title: 'Data Integrity', desc: 'Aggregated from multiple sources. Median calculation prevents manipulation.' },
        ].map(({ icon, title, desc }) => (
          <div key={title} className="card" style={{ padding: '24px' }}>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>{icon}</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#e4e1e9', marginBottom: '8px' }}>{title}</div>
            <p style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.7 }}>{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
