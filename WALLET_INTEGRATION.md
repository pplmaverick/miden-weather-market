# Wallet Integration Research

This document captures research and findings on integrating Miden Wallet
into the Weather Market dApp frontend.

## Current Status

The frontend includes a "Connect Miden Wallet" button (UI-ready).
Full wallet integration is pending SDK stability — see blockers below.

On-chain interactions currently use `miden-client` CLI directly.
Transaction history is logged in [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## Miden Wallet Ecosystem

### Official Chrome Extensions

| Extension | Purpose |
|-----------|---------|
| Miden Wallet | Testnet — stable release |
| Miden Wallet (Devnet) | Devnet — bleeding-edge features |

Both wallets support:
- Client-side proving (ZK proofs generated locally before submission)
- dApp connections with confirmation prompts
- Private and public account modes

### SDK Packages Evaluated

| Package | Version | Maintainer | Notes |
|---------|---------|-----------|-------|
| `@miden-sdk/miden-wallet-adapter` | v0.15.1 | dominik@miden.team (official) | Current — use this |
| `@miden-sdk/miden-sdk` | v0.15.2 | Miden (official) | Core WASM client |
| `@demox-labs/miden-wallet-adapter` | v0.10.0 | demox-labs | Legacy; superseded |
| `@demox-labs/miden-sdk` | v0.12.5 | demox-labs | Legacy; superseded |

> **Note:** The wallet adapter repo has been transferred from
> `demox-labs/miden-wallet-adapter` to `0xMiden/wallet-adapter`,
> indicating official Miden team adoption. Prefer `@miden-sdk/*` packages.

---

## Planned Integration Architecture

### Provider Setup

```tsx
// main.tsx
import { WalletProvider } from '@miden-sdk/miden-wallet-adapter'
import { MidenWalletAdapter } from '@miden-sdk/miden-wallet-adapter'

const wallets = [new MidenWalletAdapter({ appName: 'Miden Weather Market' })]

<WalletProvider wallets={wallets}>
  <App />
</WalletProvider>
```

### Wallet Connection

```tsx
// NavBar.tsx
import { useWallet } from '@miden-sdk/miden-wallet-adapter'

const { address, connected, connect, disconnect } = useWallet()

<button onClick={connected ? disconnect : connect}>
  {connected ? `${address?.slice(0, 8)}...` : 'Connect Miden Wallet'}
</button>
```

### Place Bet via CustomTransaction

```tsx
// Markets.tsx
import { useWallet, CustomTransaction } from '@miden-sdk/miden-wallet-adapter'

const { address, requestTransaction } = useWallet()

const handlePlaceBet = async (marketId: number, outcome: number, commitment: string) => {
  if (!address) return

  const customTx = new CustomTransaction(
    address,
    transactionRequest // TransactionRequest from @miden-sdk/miden-sdk
  )
  await requestTransaction(customTx)
}
```

### Poseidon2 Commitment (Client-Side)

The plan is to compute `bet_commitment = Poseidon2(user_secret || outcome)`
entirely in the browser using `@miden-sdk/miden-sdk` WASM bindings.

> ⚠️ The exact Poseidon2 API surface in `@miden-sdk/miden-sdk` is not yet
> documented. Current implementation uses SHA-256 as a placeholder and will
> be upgraded once the hashing API is confirmed from source.

```tsx
// Placeholder — to be replaced with Poseidon2 from @miden-sdk/miden-sdk
const computeCommitment = async (secret: string, outcome: number): Promise<string> => {
  const data = new TextEncoder().encode(`${secret}:${outcome}`)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
```

---

## Known Issues & Blockers

### 1. wallet-adapter ↔ Chrome Extension Incompatibility

Tracked in: [0xMiden/wallet-adapter Issue #9](https://github.com/demox-labs/miden-wallet-adapter/issues/9)

`miden-wallet-adapter` v0.2.1 failed to connect to the Chrome extension
because `window.midenWallet` exposed `publicKey` instead of `accountId`.
The adapter expected `accountId`, causing a runtime error on connect.

> Issue #9 is now closed. It is unclear whether this was resolved or
> closed as wontfix. Will verify against `@miden-sdk/miden-wallet-adapter`
> v0.15.1 before implementing wallet connection.

### 2. WASM Cross-Origin Isolation

`@miden-sdk/miden-sdk` compiles to WebAssembly and requires:
Cross-Origin-Opener-Policy: same-origin

Cross-Origin-Embedder-Policy: require-corp

These headers are already configured in `frontend/vercel.json` in
anticipation of full SDK integration.

### 3. CustomTransaction API Documentation

The `CustomTransaction` class supports arbitrary contract calls beyond
simple token sends. However, the exact `TransactionRequest` schema for
custom contract methods is not yet fully documented.

For a prediction market, the required call sequence is:
1. `place_bet(market_id, outcome_index, bet_commitment)` — on open market
2. `claim_winnings(market_id, user_secret, outcome_index)` — post-settlement

---

## Current Workaround

Until the wallet adapter stabilizes, the bet flow is:

1. User selects outcome + enters secret in the frontend UI
2. Frontend computes SHA-256 commitment as placeholder
3. User runs the corresponding `miden-client` CLI command locally:

```bash
# Place bet
miden-client tx new-p2id \
  --account <your-account-id> \
  --target 0xf6fec93fd713d2107154ddda438e58 \
  --note-type private

# Claim winnings
miden-client tx consume-notes \
  --account <your-account-id>
```

This preserves the ZK privacy model while the wallet SDK matures.

---

## Roadmap

- [ ] Confirm Poseidon2 hashing API in `@miden-sdk/miden-sdk` v0.15.2
- [ ] Verify Issue #9 fix status against `@miden-sdk/miden-wallet-adapter` v0.15.1
- [ ] Implement `CustomTransaction` for `place_bet` once API is documented
- [ ] Verify CLI account ↔ Miden Wallet Chrome extension interoperability
- [ ] Add wallet-gated My Bets page (fetch bets by connected `address`)

---

## References

- [Miden Wallet](https://miden.xyz/wallet)
- [0xMiden/wallet-adapter on GitHub](https://github.com/0xMiden/wallet-adapter)
- [demox-labs/miden-wallet-adapter Issue #9](https://github.com/demox-labs/miden-wallet-adapter/issues/9)
- [@miden-sdk/miden-sdk on npm](https://www.npmjs.com/package/@miden-sdk/miden-sdk)
- [@miden-sdk/miden-wallet-adapter on npm](https://www.npmjs.com/package/@miden-sdk/miden-wallet-adapter)
- [Miden Faucet](https://faucet.testnet.miden.io)
