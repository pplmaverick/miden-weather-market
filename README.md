# Miden Weather Prediction Market

![Miden Testnet](https://img.shields.io/badge/Miden_Testnet-deployed-blue)
![Rust](https://img.shields.io/badge/Rust-nightly--2025--12--10-orange)
![License](https://img.shields.io/badge/license-MIT-green)

A weather prediction market built natively on Miden, leveraging zero-knowledge proofs for private bet placement. Bets are committed on-chain via ZK commitments — the user secret never leaves the client. Settlement and payout are fully public and verifiable.

**Deployed on Miden Testnet**

| Field | Value |
|---|---|
| Contract ID | `0xcfdec78bb6b0971016d7199e27e99a` |
| Address | `mtst1ar8aa3utk6cfwyqk6uveuflfngdmujgx` |
| Deploy TX | `0x036518df898d58c5a8300165c82e549d4edebbc153a4804a7052d3c539ecf6f8` |
| Block | 807844 |
| Explorer | [midenscan.com](https://midenscan.com/account/0xcfdec78bb6b0971016d7199e27e99a) |

## Why Miden-Native

This project is built around Miden's ZK-native execution model, not ported from an EVM chain. The privacy and oracle authentication primitives would require off-chain infrastructure or trusted relayers on any other platform.

| Design concern | EVM approach | Miden-native approach |
|---|---|---|
| Private bet placement | Commit-reveal scheme with on-chain exposure during reveal | ZK commitment — `hash([market_id, outcome, amount, user_secret])` submitted; secret never transmitted or stored on-chain |
| Oracle authentication | ECDSA signature verification or trusted EOA | Poseidon commitment — `oracle_secret_hash = hash(oracle_secret)` stored at deploy; oracle reveals preimage at settlement |
| Double-claim prevention | Mapping with boolean flag | `claimed: StorageMap<Word, Felt>` written with non-zero sentinel — avoids `Felt(0)` which generates unsupported `F32Const(0.0)` WASM instruction in Miden backend |
| Payout model | Fixed odds or AMM | Parimutuel — winners share total pool proportionally to stake; odds are dynamic and reflect live bet distribution |

## Architecture

### Private Bet Commitment

The client computes `bet_commitment = hash([market_id, outcome, amount, user_secret])` locally and submits only the commitment together with the public outcome and amount. The `user_secret` is never transmitted or stored on-chain. At claim time, the user reveals the full preimage to prove ownership.

### Oracle Authentication

At deployment, `initialize(oracle_secret_hash)` stores `hash(oracle_secret_word)` on-chain. When settling, `settle_market()` requires the caller to supply the preimage `oracle_secret_word`; the contract verifies the hash before accepting the result.

Poseidon is used as the hash function throughout — Miden VM has native hardware acceleration for Poseidon, optimizing ZK proof generation speed compared to SHA-256 or Keccak.

### Parimutuel Payout

```
payout = amount × (total_pool / winning_pool)
```

All outcome pools contribute to a shared prize pool. Winners share the pot proportionally to their stake. Odds are dynamic and reflect the live distribution of bets.

## Contract Interface

| Function | Description |
|---|---|
| `initialize(oracle_secret_hash)` | One-time setup — stores the oracle's Poseidon commitment on-chain |
| `create_market(question_hash, close_time, outcomes)` | Create a new prediction market; returns `market_id` |
| `place_bet(market_id, outcome, amount, bet_commitment)` | Place a bet using a client-side ZK commitment; `user_secret` stays off-chain |
| `settle_market(market_id, winning_outcome, oracle_secret)` | Oracle reveals secret and records the winning outcome (requires `close_time` passed) |
| `claim_winnings(market_id, outcome, amount, user_secret)` | Reveal bet preimage and claim parimutuel payout |
| `get_market(market_id)` | Returns `[status, winning_outcome, close_time, outcomes_count]` |
| `get_outcome_pool(market_id, outcome)` | Returns total amount bet on a specific outcome |
| `get_market_count()` | Returns the total number of markets created |

## Storage Layout

```
WeatherMarketContract
├── initialized        : StorageValue<Felt>      # Non-zero once initialize() is called
├── market_count       : StorageValue<Felt>      # Counter; also the next market_id
├── oracle_commitment  : StorageValue<Word>      # Poseidon hash of the oracle secret word
├── markets            : StorageMap<Felt, Word>  # market_id → [status, winning_outcome, close_time, outcomes_count]
├── outcome_pools      : StorageMap<Felt, Felt>  # pool_key(market_id, outcome) → cumulative bet amount
├── bets               : StorageMap<Word, Felt>  # bet_commitment → amount (0 = not placed)
└── claimed            : StorageMap<Word, Felt>  # bet_commitment → non-zero if already claimed
```

## Repository Structure

```
miden-weather-market/
├── counter-contract/   # Minimal counter contract (compilation sanity check)
└── weather-market/     # Main contract: Weather Prediction Market
```

## Development

**Toolchain**

`rust-toolchain.toml`:

```toml
channel = "nightly-2025-12-10"
targets = ["wasm32-wasip2"]
components = ["rustfmt", "rust-src", "llvm-tools"]
```

**Install cargo-miden**

```bash
cargo +nightly-2025-12-10 install cargo-miden --locked --version 0.8.1
```

**Build**

```bash
cargo miden build --release
# Output: target/miden/release/weather_market.masp
```

## Implementation Notes

**F32Const sentinel pattern**
Writing `Felt(0)` directly from source code generates an unsupported `F32Const(0.0)` WASM instruction in the Miden backend. The `claimed` StorageMap uses a non-zero sentinel value instead, avoiding this compiler-level constraint entirely.

**Restricted Rust subset**
Miden contracts compile to WASM via a nightly Rust toolchain targeting `wasm32-wasip2`. Standard library features that produce unsupported WASM instructions must be avoided — this shapes data structure choices throughout the contract.

## Roadmap

**✅ M1 — Testnet Deployment (completed)**
- Native Miden contract with ZK bet commitments
- Poseidon-based oracle authentication
- Parimutuel payout model
- Deployed to Miden Testnet (block 807844)

**⬜ M2 — Expanded Features**
- Client-side commitment generator (TypeScript/WASM)
- Weather oracle integration (OpenWeather API → settle_market)
- Frontend for market creation and bet placement

**⬜ M3 — Mainnet**
- Deploy to Miden Mainnet when available
- Multi-outcome markets (temperature ranges, not just above/below)

## Developer

GitHub: [pplmaverick](https://github.com/pplmaverick)
Wallet: `0xed2B...78F5` — deployed on Miden Testnet

## License

MIT
