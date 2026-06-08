# Miden Weather Market — Deployment Guide

## Environment Requirements

| Component | Version | Notes |
|---|---|---|
| Rust toolchain | `nightly-2025-12-10` | Required; newer nightlies may break WASM codegen |
| Target | `wasm32-wasip2` | WASM component target |
| cargo-miden | `0.8.1` | Miden contract build tool |
| miden-client | `0.14.0` | Via `midenup` installer |

### Install Toolchain

```bash
rustup toolchain install nightly-2025-12-10 \
  --component rustfmt rust-src llvm-tools \
  --target wasm32-wasip2

cargo +nightly-2025-12-10 install cargo-miden --locked --version 0.8.1
```

### miden-client Binary Path

```bash
MIDEN_CLIENT="$HOME/Library/Application Support/midenup/toolchains/0.14.0/bin/miden-client"
```

---

## Build

```bash
cd /Users/pplmaverick/miden-weather-market/weather-market
cargo miden build --release
# Output: target/miden/release/weather_market.masp  (~292 KB)
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
MIDEN_CLIENT="$HOME/Library/Application Support/midenup/toolchains/0.14.0/bin/miden-client"
cd /Users/pplmaverick/miden-weather-market

"$MIDEN_CLIENT" new-account \
  --account-type regular-account-updatable-code \
  --storage-mode public \
  -p weather-market/target/miden/release/weather_market.masp \
  --init-storage-data-path weather-market/init_storage.toml \
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

## v5 Contract (Current)

| Field | Value |
|---|---|
| Account ID | `0xf6fec93fd713d2107154ddda438e58` |
| Type | Regular (updatable), Public |
| Deploy TX | `0x9f0128e129f665831658d96841a250d71a91e6afb41546075d1058cd59fe2d60` |
| Deploy Block | 1172769 |
| Initialize TX | `0x630eb38c80988a8bb4af80ef8ef9237732783d17a8d6594929e43e5220b6139e` |
| Initialize Block | 1172920 |

### v5 End-to-End Test (market_id=0)

| Step | TX Hash | Block |
|---|---|---|
| create_market | `0x8b9384dbd77e8a9e99037531228d83a44a0f9aedb6adbd3710db1c0ff526a9f1` | 1172978 |
| place_bet | `0x8976303c9c5dde3ff97843fa6816ff0a32a3baff4fd466a33dc7f98d63314776` | 1173095 |
| settle_market | (submitted; hash not locally captured) | — |
| claim_winnings | `0x7286d9b03ce7e0dceb55180ae293e3adf67106f053536060c1eb434474a79f7b` | 1173367 |

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
