# Miden Weather Prediction Market

A weather prediction market built natively on [Miden](https://polygon.technology/miden), leveraging zero-knowledge proofs for private bet placement. Bets are committed on-chain via ZK commitments — the user secret never leaves the client. Settlement and payout are fully public and verifiable.

## Repository Structure

```
miden-weather-market/
├── counter-contract/   # Minimal counter contract (compilation sanity check)
└── weather-market/     # Main contract: Weather Prediction Market
```

## Contract Interface

| Function | Description |
|---|---|
| `initialize(oracle_secret_hash)` | One-time setup — stores the oracle's Poseidon commitment on-chain |
| `create_market(question_hash, close_time, outcomes)` | Create a new prediction market; returns `market_id` |
| `place_bet(market_id, outcome, amount, bet_commitment)` | Place a bet using a client-side commitment; `user_secret` stays off-chain |
| `settle_market(market_id, winning_outcome, oracle_secret)` | Oracle reveals secret and records the winning outcome (requires `close_time` passed) |
| `claim_winnings(market_id, outcome, amount, user_secret)` | Reveal bet preimage and claim parimutuel payout |
| `get_market(market_id)` | Returns `[status, winning_outcome, close_time, outcomes_count]` |
| `get_outcome_pool(market_id, outcome)` | Returns total amount bet on a specific outcome |
| `get_market_count()` | Returns the total number of markets created |

## Architecture

### Private Bet Commitment
The client computes `bet_commitment = hash([market_id, outcome, amount, user_secret])` locally and submits only the commitment together with the public `outcome` and `amount`. The `user_secret` is never transmitted or stored on-chain. At claim time, the user reveals the full preimage to prove ownership.

### Oracle Authentication
At deployment, the deployer calls `initialize(oracle_secret_hash)` where `oracle_secret_hash = hash(oracle_secret_word)`. When settling, `settle_market()` requires the caller to supply the preimage `oracle_secret_word`; the contract verifies the hash before accepting the result.

### Parimutuel Payout Model
```
payout = amount × total_pool / winning_pool
```
All outcome pools contribute to a shared prize pool. Winners share the pot proportionally to their stake. Odds are dynamic and reflect the live distribution of bets.

### Double-Claim Prevention
Claimed bets are tracked in a dedicated `claimed: StorageMap<Word, Felt>`, written with a non-zero sentinel value. This avoids writing `Felt(0)` from source code, which would generate an unsupported `F32Const(0.0)` WASM instruction in the Miden backend.

## Testnet Deployment

| Field | Value |
|---|---|
| **Contract ID** | `0xcfdec78bb6b0971016d7199e27e99a` |
| **Address** | `mtst1ar8aa3utk6cfwyqk6uveuflfngdmujgx` |
| **Deploy TX** | `0x036518df898d58c5a8300165c82e549d4edebbc153a4804a7052d3c539ecf6f8` |
| **Block** | 807844 |
| **Network** | Miden Testnet |

**Explorer:** https://midenscan.com/account/0xcfdec78bb6b0971016d7199e27e99a

## Development

**Toolchain:**
```toml
# rust-toolchain.toml
channel = "nightly-2025-12-10"
targets = ["wasm32-wasip2"]
components = ["rustfmt", "rust-src", "llvm-tools"]
```

**Install cargo-miden:**
```bash
cargo +nightly-2025-12-10 install cargo-miden --locked --version 0.8.1
```

**Build:**
```bash
cargo miden build --release
# Output: target/miden/release/weather_market.masp
```

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
