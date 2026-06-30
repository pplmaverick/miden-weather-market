import { NavLink } from 'react-router-dom'
import { WalletMultiButton } from '@miden-sdk/miden-wallet-adapter'

export default function NavBar() {
  return (
    <nav style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 32px',
      borderBottom: '1px solid rgba(155,89,245,0.2)',
      position: 'sticky', top: 0,
      background: 'rgba(10,10,15,0.92)',
      backdropFilter: 'blur(12px)',
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '18px' }}>⛅</span>
        <span style={{ color: 'rgba(155,89,245,1)', fontWeight: 700, fontSize: '15px', letterSpacing: '-0.01em' }}>
          MIDEN WEATHER MARKET
        </span>
        <span className="badge badge-testnet">TESTNET</span>
      </div>

      <div style={{ display: 'flex', gap: '4px' }}>
        {[
          { to: '/', label: 'Markets' },
          { to: '/my-bets', label: 'My Bets' },
          { to: '/settle', label: 'Settle' },
          { to: '/how-it-works', label: 'How It Works' },
        ].map(({ to, label }) => (
          <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => ({
            padding: '8px 16px',
            borderRadius: '999px',
            textDecoration: 'none',
            fontSize: '13px',
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: isActive ? 600 : 400,
            color: isActive ? 'rgba(155,89,245,1)' : '#64748b',
            background: isActive ? 'rgba(155,89,245,0.1)' : 'transparent',
            border: isActive ? '1px solid rgba(155,89,245,0.3)' : '1px solid transparent',
            transition: 'all 0.2s',
          })}>
            {label}
          </NavLink>
        ))}
      </div>

      {/* Real Miden Wallet connection button — handles connect/disconnect/address display */}
      <WalletMultiButton />
    </nav>
  )
}
