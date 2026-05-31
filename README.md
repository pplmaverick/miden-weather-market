# Miden Weather Prediction Market

![Miden Testnet](https://img.shields.io/badge/Miden_Testnet-deployed-blue)
![Rust](https://img.shields.io/badge/Rust-nightly--2025--12--10-orange)
![License](https://img.shields.io/badge/license-MIT-green)

ZK-native prediction market infrastructure on Miden | Weather as first use case | private bet placement via ZK commitments — user secret never leaves client | fully verifiable on-chain settlement
**Deployed on Miden Testnet**

### v5 (current — full end-to-end verified)

| Field | Value |
|---|---|
| Contract ID | `0xf6fec93fd713d2107154ddda438e58` |
| Deploy TX | `0x9f0128e129f665831658d96841a250d71a91e6afb41546075d1058cd59fe2d60` |
| Block | 1172769 |

### v2 (initial deployment)

| Field | Value |
|---|---|
| Contract ID | `0x881ed92bbd9e0410374f75f269507a` |
| Address | `mtst1azypakfthk0qgyphfa6ly62s0ga2ycnq` |
| Deploy TX | `0xcccdcba958bba718ba213703067bd0d891a864bb5cd8f5f7963ac1eed54b126f` |
| Block | 984144 |
| Explorer | [midenscan.com](https://midenscan.com/account/0x881ed92bbd9e0410374f75f269507a) |

## On-chain Activity

### v5 — Full End-to-End Flow (2026-05-31)

Contract: `0xf6fec93fd713d2107154ddda438e58`

| TX | Block | Description |
|---|---|---|
| `0x9f0128e129f665831658d96841a250d71a91e6afb41546075d1058cd59fe2d60` | 1172769 | Contract deployed (v5) |
| `0x630eb38c80988a8bb4af80ef8ef9237732783d17a8d6594929e43e5220b6139e` | 1172920 | `initialize()` v5 |
| `0x8b9384dbd77e8a9e99037531228d83a44a0f9aedb6adbd3710db1c0ff526a9f1` | 1172978 | `create_market()` — market_id 0 |
| `0x8976303c9c5dde3ff97843fa6816ff0a32a3baff4fd466a33dc7f98d63314776` | 1173095 | `place_bet()` — outcome 1, amount 1 (Poseidon2 commitment) |
| *(not captured)* | ~1173200 | `settle_market()` — winning_outcome 1 ✅ |
| `0x7286d9b03ce7e0dceb55180ae293e3adf67106f053536060c1eb434474a79f7b` | 1173367 | `claim_winnings()` ✅ |

> settle TX was committed on-chain (confirmed by `get_market(0)` returning `status=2` and by the subsequent `claim_winnings` succeeding); the hash was not captured locally due to a `MerkleStoreError` in `apply_transaction` after network submission.

### v2 — Initial Deployment

Contract: `0x881ed92bbd9e0410374f75f269507a`

| TX | Block | Description |
|---|---|---|
| `0xcccdcba958bba718ba213703067bd0d891a864bb5cd8f5f7963ac1eed54b126f` | 984144 | Contract deployed (v2, Falcon512 auth) |
| `0x1ed89d2c29cf30b3edc18146add311c9e85b4f1d25fe96f468baebb8cd604751` | 1126160 | `initialize(oracle_pubkey_hash)` |
| `0x5aada4a519f441b5ad66e5386e4d5eebb7bd9802b55b1a2143feb2b506585229` | 1141137 | `create_market()` — **void** (wrong proc — called `cabi_realloc`) |
| `0x3ca6c668fe404296874700d873544b5203a89382e220904359771f5320c5c373` | 1143415 | `create_market()` — market_id 0 ✅ |
| `0xe59c1ecd98764cbdaa3dd661f5ac0d3a8721f267190671810a8277fe2b531971` | 1143746 | `place_bet()` — market_id 0, outcome 1 (Yes), amount 1 ✅ |

### Market 0

| Field | Value |
|---|---|
| create_market TX | `0x3ca6c668fe404296874700d873544b5203a89382e220904359771f5320c5c373` |
| place_bet TX | `0xe59c1ecd98764cbdaa3dd661f5ac0d3a8721f267190671810a8277fe2b531971` |
| Block (created) | 1143415 |
| market_id | `0` |
| Question | `"Will Taipei max temp exceed 30°C tomorrow?"` |
| close_time | `1780196539` |
| Outcomes | `2` — `0 = No`, `1 = Yes` |

## Why Miden-Native

This project is built around Miden's ZK-native execution model, not ported from an EVM chain. The privacy and oracle authentication primitives would require off-chain infrastructure or trusted relayers on any other platform.

| Design concern | EVM approach | Miden-native approach |
|---|---|---|
| Private bet placement | Commit-reveal scheme with on-chain exposure during reveal | ZK commitment — `hash([market_id, outcome, amount, user_secret])` submitted; secret never transmitted or stored on-chain |
| Oracle authentication | ECDSA signature verification or trusted EOA | Falcon512 signature — `oracle_pubkey_hash = Poseidon2(falcon512_pubkey)` stored at deploy; oracle signs `(market_id, outcome)` off-chain; σ verified inside ZK proof via `rpo_falcon512_verify`; signature never appears in calldata |
| Double-claim prevention | Mapping with boolean flag | `claimed: StorageMap<Word, Felt>` written with non-zero sentinel — avoids `Felt(0)` which generates unsupported `F32Const(0.0)` WASM instruction in Miden backend |
| Payout model | Fixed odds or AMM | Parimutuel — winners share total pool proportionally to stake; odds are dynamic and reflect live bet distribution |

## Architecture

### Private Bet Commitment

The client computes `bet_commitment = hash([market_id, outcome, amount, user_secret])` locally and submits only the commitment together with the public outcome and amount. The `user_secret` is never transmitted or stored on-chain. At claim time, the user reveals the full preimage to prove ownership.

### Oracle Authentication

Oracle identity is verified with a **Falcon512 post-quantum signature** rather than a secret word hash. This eliminates the front-running attack vector where a mempool observer could copy the revealed preimage before the original transaction is included.

**Setup** — `initialize(oracle_pubkey_hash)` stores `Poseidon2(oracle_falcon512_pubkey)` on-chain. The full public key is never stored; only its 4-element Poseidon2 hash is committed to storage.

**Settlement flow:**

```
1. Oracle computes:  msg = Poseidon2([market_id, winning_outcome, 0, 0])
2. Oracle signs:     σ  = Falcon512_sign(msg, oracle_secret_key)
3. Oracle builds tx: provides σ via advice provider (off-chain ZK hint)
4. Contract runs:
       emit_falcon_sig_to_stack(msg, pk_hash)  // host pushes σ onto advice stack
       rpo_falcon512_verify(pk_hash, msg)       // verify inside ZK proof; panic → tx rollback if invalid
```

σ never appears in `settle_market`'s calldata. Mempool observers only see `(market_id, winning_outcome)`. The signature is consumed inside the ZK proof and is not recoverable from on-chain data.

Poseidon2 (RPO256) is used as the hash function throughout — Miden VM has native hardware acceleration for it, making both commitment checks and Falcon512 key-hash lookups gas-efficient.

### Parimutuel Payout

```
payout = amount × (total_pool / winning_pool)
```

All outcome pools contribute to a shared prize pool. Winners share the pot proportionally to their stake. Odds are dynamic and reflect the live distribution of bets.

## Contract Interface

| Function | Description |
|---|---|
| `initialize(oracle_pubkey_hash)` | One-time setup — stores `Poseidon2(oracle_falcon512_pubkey)` on-chain |
| `create_market(question_hash, close_time, outcomes)` | Create a new prediction market; returns `market_id` |
| `place_bet(market_id, outcome, amount, bet_commitment)` | Place a bet using a client-side ZK commitment; `user_secret` stays off-chain |
| `settle_market(market_id, winning_outcome)` | Oracle provides Falcon512 signature via advice provider; contract verifies inside ZK proof (requires `close_time` passed) |
| `claim_winnings(market_id, outcome, amount, user_secret)` | Reveal bet preimage and claim parimutuel payout |
| `get_market(market_id)` | Returns `[status, winning_outcome, close_time, outcomes_count]` |
| `get_outcome_pool(market_id, outcome)` | Returns total amount bet on a specific outcome |
| `get_market_count()` | Returns the total number of markets created |
| `get_oracle_pubkey_hash()` | Returns the stored Oracle Falcon512 public key hash |

## Storage Layout

```
WeatherMarketContract
├── initialized        : StorageValue<Felt>      # Non-zero once initialize() is called
├── market_count       : StorageValue<Felt>      # Counter; also the next market_id
├── oracle_pubkey_hash : StorageValue<Word>      # Poseidon2 hash of the Oracle's Falcon512 public key
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

**`exec` vs `call` for procedures returning a value**
The v2 contract was compiled with an older Miden SDK where procedures with a `-> felt` return type push the return value *after* `truncate_stack`, leaving stack depth at 17. Using `call.0xPROC_HASH` from a transaction script triggers a VM-level "stack depth must be 16" violation at the procedure boundary. Using `exec.0xPROC_HASH` runs the procedure inline (no call frame), bypassing that per-boundary check. The return value sits at the top of the stack after `exec` and is removed with a trailing `drop` to restore depth to 16 before the script ends.

**Restricted Rust subset**
Miden contracts compile to WASM via a nightly Rust toolchain targeting `wasm32-wasip2`. Standard library features that produce unsupported WASM instructions must be avoided — this shapes data structure choices throughout the contract.

## Roadmap

**✅ M1 — Testnet Deployment (completed)**
- Native Miden contract with ZK bet commitments
- Parimutuel payout model
- Deployed to Miden Testnet (block 807844, v1)

**✅ M1.5 — Falcon512 Oracle Auth (completed)**
- Replaced secret-hash oracle with Falcon512 post-quantum signature verification
- Oracle signature verified inside ZK proof via `rpo_falcon512_verify`; never appears in calldata
- Eliminates front-running risk on settlement
- Redeployed to Miden Testnet (block 984144, v2)

**✅ M1.6 — First Market Created (completed)**
- `create_market()` called on-chain — market_id `0`
- Question: `"Will Taipei max temp exceed 30°C tomorrow?"`
- TX `0x3ca6c668...` committed at block 1143415

**✅ M1.7 — First Bet Placed (completed)**
- `place_bet()` called on-chain — market_id `0`, outcome `1` (Yes), amount `1`
- ZK commitment submitted; `user_secret` never leaves client
- TX `0xe59c1ecd...` committed at block 1143746

**✅ M1.8 — Full End-to-End Flow Completed (v5)**
- `initialize → create_market → place_bet → settle_market → claim_winnings` all succeeded on-chain
- Diagnosed and fixed Poseidon2/RPO256 hash mismatch in `place_bet` client tool — `make_bet_commitment` in the contract uses `miden::hash_words` (Poseidon2); client-side commitment generation now uses `miden_crypto::Poseidon2::hash_elements` to match
- `claim_winnings` TX `0x7286d9b0...` committed at block 1173367 on v5 contract `0xf6fec93f...`

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
