# Miden Weather Market — Deployment Guide

## Environment Requirements

| Component | Version | Notes |
|---|---|---|
| Rust toolchain | `nightly-2025-12-10` | Required; newer nightlies may break WASM codegen |
| Target | `wasm32-wasip2` | WASM component target |
| cargo-miden | `0.8.1` | Miden contract build tool |
| miden-client | `0.15.2` | Via `midenup` installer |

### Install Toolchain

```bash
rustup toolchain install nightly-2025-12-10 \
  --component rustfmt rust-src llvm-tools \
  --target wasm32-wasip2

cargo +nightly-2025-12-10 install cargo-miden --locked --version 0.8.1
```

### miden-client Binary Path

```bash
MIDEN_CLIENT="$HOME/Library/Application Support/midenup/toolchains/0.15.2/bin/miden-client"
```

---

## Build

```bash
cd /Users/pplmaverick/miden-weather-market/weather-market
cargo miden build --release
# Output: target/midenc/miden/release/weather-market.masp
# (cargo-miden 0.8.1 changed output path from target/miden/ to target/midenc/miden/)
```

---

## Deploy

### 1. Prepare init_storage.toml

Initial storage sets `initialized = 0` (the `initialize()` method will set it to `1`).

```bash
# The file is already present at:
# weather-market/init_storage.toml
```

### 2. Deploy Contract Account

```bash
# miden-client 0.15.x syntax (changed from 0.14)
MIDEN_CLIENT="$HOME/Library/Application Support/midenup/toolchains/0.15.2/bin/miden-client"
cd /Users/pplmaverick/miden-weather-market

"$MIDEN_CLIENT" new-account \
  -t public \
  -p weather-market/target/midenc/miden/release/weather-market.masp \
  -i weather-market/init_storage.toml \
  --deploy
```

The command prints the new **Account ID** — record it.

### 3. Initialize

Update `submit-initialize/src/main.rs` with the new Account ID and the oracle pubkey hash, then:

```bash
cd tools/submit-initialize
cargo run --release
```

---

## Explorer

**Testnet block explorer:** https://testnet.midenscan.com

URL patterns (confirmed):
- Account: `https://testnet.midenscan.com/account/<account_id>`
- Transaction: `https://testnet.midenscan.com/tx/<tx_hash>`
- Block: `https://testnet.midenscan.com/block/<block_number>`

> Note: Miden is a ZK rollup — explorer TX pages show only TX ID, account address, and block number.
> Function names, arguments, and storage changes are hidden by design (ZK proof).

---

## v0.15 Testnet Redeployment (2026-06-25)

### Environment
- miden-client: 0.15.2
- Network: rpc.testnet.miden.io

### New Wallet
`0x2b46396710ace5b15c150f76d26812`

### Contract v7
`0x72df3f2c728125716878e6af1422af`
Explorer: https://testnet.midenscan.com/account/0x72df3f2c728125716878e6af1422af

### v0.15 e2e TX Hashes

| Step | TX Hash |
|------|---------|
| initialize | `0x8cc89e14e738f51f698712b3188d7ae57e07dc7ce1fbe1cef4df138cc5844a67` |
| create_market | `0xdb97d74613e1fec80839de1fddc4723a666218d4667730bc9354effac33ba398` |
| place_bet | `0x7a511d62f4a3340dc79411f5812efa12571bede4f0e960bfef63adc5f873a3bf` |
| settle_market | `0xad658d072b848416f85fe37480e9408db8b6c5879cf2ce06ee9faabd0bbf1233` |
| claim_winnings | `0x303cf9b9ad170fcc8075e92876666d466158eca1de33156970de566f087077a8` |

### Key Technical Note
proc hash format: LE (`digest.to_hex()`) — not BE

---

## v7 Contract (Current — 2026-06-30)

v7 is the production-ready build. Key changes from v6:
- `create_market` and `claim_winnings` are **void** (no `-> Felt` return)
- Fixes `InvalidStackDepthOnReturn { depth: 17 }` caused by component-model wrapper pushing return value after `truncate_stack` at D=16

| Field | Value |
|---|---|
| Account ID | `0x72df3f2c728125716878e6af1422af` |
| Explorer | https://testnet.midenscan.com/account/0x72df3f2c728125716878e6af1422af |
| Type | Regular (updatable), Public |
| miden-client | 0.15.2 |

### v7 Proc Hashes (LE format — use directly in `call.0xHASH`)

Obtained from `Package::read_from_bytes()` + `digest.to_hex()` via `tools/query-v4-procs`.

| Method | Signature | Call Hash (LE format) |
|---|---|---|
| `initialize` | `(oracle_pk_hash: Word)` | `0x229a42d79f6d287fcf1dff1b372662e4d9d0e54984c81511db5ad51cfbf12abd` |
| `create_market` | `(question_hash: Word, close_time: Felt, outcomes: Felt)` — void | `0x901e1be1b97baa9d132a87350ef42624fd06cf0513a8d1cd34e884b43f2b8178` |
| `place_bet` | `(market_id: Felt, outcome: Felt, amount: Felt, commitment: Word)` | `0x7ed76d95ac446cbaf23785cf3f581afefb81bd02e74b6e9f1758446c917e000f` |
| `settle_market` | `(market_id: Felt, winning_outcome: Felt)` | `0xdf071bb886e6fa55466026caa27d1a2e3ba0d93e982c02d0055a4025a033dc20` |
| `claim_winnings` | `(market_id: Felt, outcome: Felt, amount: Felt, user_secret: Felt)` — void | `0xa8a32516f30b214fefcb49527415d92430b5b2daf13a7773577350d640ceea0a` |

### v7 End-to-End Test (market_id=0, 2026-06-30)

Full flow: initialize → create_market → place_bet (secret=42) → settle_market → claim_winnings

| Step | TX Hash | Notes |
|---|---|---|
| initialize | `0x8cc89e14e738f51f698712b3188d7ae57e07dc7ce1fbe1cef4df138cc5844a67` | First init of v7 contract |
| create_market | `0xdb97d74613e1fec80839de1fddc4723a666218d4667730bc9354effac33ba398` | outcomes=2, close_time=block_ts+120s |
| place_bet | `0x7a511d62f4a3340dc79411f5812efa12571bede4f0e960bfef63adc5f873a3bf` | market_id=0, outcome=0, amount=100, secret=42 |
| settle_market | `0xad658d072b848416f85fe37480e9408db8b6c5879cf2ce06ee9faabd0bbf1233` | winning_outcome=0, block_ts=1782758883 > close_time=1782758877 |
| claim_winnings | `0x303cf9b9ad170fcc8075e92876666d466158eca1de33156970de566f087077a8` | market_id=0, outcome=0, amount=100, secret=42, payout=100 |

### Week 5 Markets (2026-06-30) — 24h close window

Three markets created for frontend demo. Contract assigns IDs sequentially from `market_count`.

**Note:** The v7 e2e test (above) created and settled market_id=0, advancing `market_count` to 1.
These Week 5 markets therefore start at market_id=1, not 0.

| market_id | City   | Question            | Threshold | TX Hash | close_time |
|-----------|--------|---------------------|-----------|---------|------------|
| 1         | Taipei | Temp > 32.0°C?      | 32.0°C    | `0x82ce6df99dbef3dd7c66d5c2ea74996576790542c4c6156a8b660b115a0fd084` | 1782873837 |
| 2         | Tokyo  | Temp > 27.0°C?      | 27.0°C    | `0x84b9b5696bed2440e16e94d5e17b526077a676da08605506eafaffa161041c0e` | 1782873915 |
| 3         | Seoul  | Temp > 27.0°C?      | 27.0°C    | `0x51edaba89b142bd74a740dd09739329f5f8f1ef5497fa405268d22acd687ca41` | 1782873999 |

Frontend: https://miden-weather-market.vercel.app

---

## v5 Contract (Archived)

| Field | Value |
|---|---|
| Account ID | `0xf6fec93fd713d2107154ddda438e58` |
| Explorer | https://testnet.midenscan.com/account/0xf6fec93fd713d2107154ddda438e58 |
| Type | Regular (updatable), Public |
| Deploy TX | `0x9f0128e129f665831658d96841a250d71a91e6afb41546075d1058cd59fe2d60` |
| Deploy Block | 1172769 |
| Initialize TX | `0x630eb38c80988a8bb4af80ef8ef9237732783d17a8d6594929e43e5220b6139e` |
| Initialize Block | 1172920 |

### v5 End-to-End Test — Run 1 (market_id=0, 2026-05-31)

| Step | TX Hash | Block |
|---|---|---|
| create_market | `0x8b9384dbd77e8a9e99037531228d83a44a0f9aedb6adbd3710db1c0ff526a9f1` | 1172978 |
| place_bet | `0x8976303c9c5dde3ff97843fa6816ff0a32a3baff4fd466a33dc7f98d63314776` | 1173095 |
| settle_market | (submitted; hash not locally captured) | — |
| claim_winnings | `0x7286d9b03ce7e0dceb55180ae293e3adf67106f053536060c1eb434474a79f7b` | 1173367 |

### v5 End-to-End Test — Run 2 (market_id=1, 2026-06-08)

| Step | TX Hash | Block |
|---|---|---|
| create_market | `0x18783aee8e60184dd7284e985b4891d70d5fde523c1a628ef5c29d499f7888ba` | — |
| place_bet | `0x7a7c819301ad2ba760d3ae72d969c6dbcffe016288c673a12ec873a838e71246` | — |
| settle_market | `0xcb4447099a959d1f884b5e8cb0ab29b4912b899f2f9a0780ed59306b817d7f98` | — |
| claim_winnings | `0x9671248e46571a4b58a111ecdc0df50dac01341008793d2ccb86520d7998c1f8` | 1414057 |

---

## Proc Hash Table (v5)

The v5 contract uses identical code to v4; all proc hashes are the same.

> **Important:** `call.0xHEX` in Miden assembly uses **little-endian per 8-byte chunk**.  
> The MASP inspector shows MASP order (big-endian per chunk). Always byte-reverse each chunk.

### Mutable Methods (use with `submit_new_transaction`)

| Method | Signature | Call Hash (LE format) |
|---|---|---|
| `initialize` | `(oracle_pubkey_hash: Word)` | `0xfdbdca5a7d86921fe12a0c6deba4e9ec4ea51faea7c15993c0942dabc66cc11f` |
| `create_market` | `(question_hash: Word, close_time: Felt, outcomes: Felt) → Felt` | `0x967af88a92d6caedd4fc925c575633945034d4820423f84c752e23eae338f553` |
| `place_bet` | `(market_id: Felt, outcome: Felt, amount: Felt, commitment: Word)` | `0x5664222d2dc60614d16bc6a50b9ffa4327b6f14c15f2faffca8d884b91bf2002` |
| `settle_market` | `(market_id: Felt, winning_outcome: Felt)` | `0x82a863b742b7662c9302b5f549ea3ab929352f9c791bc905375185ab7d81fcf1` |
| `claim_winnings` | `(market_id: Felt, outcome: Felt, amount: Felt, user_secret: Felt) → Felt` | `0x3341aac8c50c19af589ec880a3a81929a99bb312ee5182a84b852a596e8656d2` |

### View Functions (use with `miden-client exec`, local only — no TX)

| Method | MASP Hash (exec format) |
|---|---|
| `get_market` | `0x1bfb25260454c59c...` |
| `get_outcome_pool` | `0xa156b0e96759591d...` |
| `get_market_count` | `0x391a164a65d95c4b...` |
| `get_oracle_pubkey_hash` | `0x6845426847d5c20c...` |

### MASP Order (inspector reference)

| Method | MASP Order |
|---|---|
| `initialize` | `0x1f92867d5acabdfdece9a4eb6d0c2ae19359c1a7ae1fa54e1fc16cc6ab2d94c0` |
| `create_market` | `0xedcad6928af87a96943356575c92fcd44cf8230482d4345053f538e3ea232e75` |
| `place_bet` | `0x1406c62d2d22645643fa9f0ba5c66bd1fffaf2154cf1b6270220bf914b888dca` |
| `settle_market` | `0x2c66b742b763a882b93aea49f5b5029305c91b799c2f3529f1fc817dab855137` |
| `claim_winnings` | `0xaf190cc5c8aa41332919a8a380c89e58a88251ee12b39ba9d256866e592a854b` |

---

## Submit Tools

All tools live in `tools/` as separate Rust crates. Each calls `submit_new_transaction` against the contract account, producing an on-chain TX.

### submit-v5-full-flow (recommended for testnet)

Runs all five steps automatically (initialize → create → bet → wait → settle → claim).  
Edit the constants at the top of `src/main.rs` before running.

```bash
cd tools/submit-v5-full-flow
cargo run --release
```

Waits for `close_time` with a 10-second polling loop. Default `CLOSE_DELAY_SECS = 90`.

### submit-initialize

```bash
cd tools/submit-initialize
# Edit CONTRACT_ID and oracle_pubkey_hash in src/main.rs
cargo run --release
```

### submit-create-market

```bash
cd tools/submit-create-market
# Edit CLOSE_TIME and CONTRACT_ID in src/main.rs
cargo run --release
```

### submit-place-bet

Uses Poseidon2 to compute `bet_commitment` client-side, then submits.

```bash
cd tools/submit-place-bet
# Edit MARKET_ID, OUTCOME, AMOUNT, USER_SECRET in src/main.rs
cargo run --release
# Save the printed bet_commitment — needed for claim
```

### submit-settle-market

```bash
cd tools/submit-settle-market
# Set market_id and winning_outcome in src/main.rs
# Ensure block_ts >= close_time before running
cargo run --release
```

### submit-claim-winnings

```bash
cd tools/submit-claim-winnings
# Edit MARKET_ID, OUTCOME, AMOUNT, USER_SECRET in src/main.rs
# USER_SECRET must match the value used in place_bet
cargo run --release
```

---

## ABI: Passing Arguments in Transaction Scripts

Miden assembly for calling a contract procedure with N arguments:

```masm
begin
    push.<arg_N>      swap.<N+1> drop   ; last arg first
    push.<arg_N-1>    swap.<N>   drop
    ...
    push.<arg_1>      swap.1     drop   ; first arg last
    call.0x<PROC_HASH>
end
```

For a `Word` argument (4 Felts), each Felt occupies one stack slot:

```masm
; Word = [w0, w1, w2, w3] — w3 pushed first (highest slot)
push.<w3>  swap.<base+3> drop
push.<w2>  swap.<base+2> drop
push.<w1>  swap.<base+1> drop
push.<w0>  swap.<base+0> drop
```

---

## Common Errors

### `call` vs `exec`

| Command | Produces TX | Use For |
|---|---|---|
| `miden-client exec` | No — local only | View functions, debugging |
| `submit_new_transaction` | Yes — on-chain | State-mutating calls |

Using `exec` for `initialize`, `create_market`, etc. will appear to succeed locally but produces **no on-chain TX hash**.

### RPO vs Poseidon2 Commitment Mismatch

The contract's `make_bet_commitment` uses `miden::hash_words` = **Poseidon2**.  
If the client tool computes the commitment with `Rpo256::hash_elements`, the stored hash will not match the claim-time hash → `"bet not found"` error.

**Fix:** always use `miden_crypto::hash::poseidon2::Poseidon2::hash_elements` in client tools.

```rust
// Correct
use miden_crypto::hash::poseidon2::Poseidon2;
let digest = Poseidon2::hash_elements(&elements);

// Wrong — different hash function, different output
use miden_crypto::hash::rpo::Rpo256;
let digest = Rpo256::hash_elements(&elements);
```

### LE Byte-Reverse for `call.0xHEX`

The MASP inspector reports procedure hashes in MASP order (BE per 8-byte chunk).  
Transaction scripts require each chunk byte-reversed (LE):

```python
masp = "1f92867d5acabdfdece9a4eb6d0c2ae19359c1a7ae1fa54e1fc16cc6ab2d94c0"
chunks = [masp[i:i+16] for i in range(0, 64, 16)]
call_hex = "".join(bytes.fromhex(c)[::-1].hex() for c in chunks)
# Result: fdbdca5a7d86921fe12a0c6deba4e9ec4ea51faea7c15993c0942dabc66cc11f
```

Using the raw MASP order in `call.0x...` will invoke a **different** (likely non-existent) procedure, causing a silent failure or wrong-proc error.

### `already initialized` Panic

`initialize()` asserts `self.initialized.get() == 0`. Running it twice against the same contract account panics. Deploy a new account if re-initialization is needed.

### `market not yet closed` on settle

`settle_market` requires `block_ts >= close_time`. If running immediately after `create_market`, wait for sufficient blocks to pass. Use a short `CLOSE_DELAY_SECS` (e.g., 90) for testnet testing.
