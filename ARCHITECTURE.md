# Miden Weather Market — Architecture

## Project Overview

Miden Weather Market is a ZK-native prediction market built on the [Miden](https://polygon.technology/polygon-miden) rollup. Users place private bets on weather outcomes using cryptographic commitments — the bet secret never leaves the client. Settlement and payout are fully verifiable on-chain via Miden's ZK proof system.

**First use case:** Binary weather outcomes (e.g., "Will it rain in Taipei on 2026-06-15?")  
**Settlement model:** Parimutuel — all losing bets fund the winning pool proportionally.  
**Privacy model:** Bet details are hidden behind a Poseidon2 commitment; only the commitment hash is stored on-chain.

---

## Contract Design

### Storage Layout

The contract (`WeatherMarketContract`) uses Miden's `StorageValue` and `StorageMap` primitives, which map to on-chain state slots identified by blake3-derived IDs.

| Field | Type | Purpose |
|---|---|---|
| `initialized` | `StorageValue<Felt>` | Re-initialisation guard (non-zero once set) |
| `oracle_pubkey_hash` | `StorageValue<Word>` | Poseidon2 hash of the Oracle's Falcon512 public key |
| `market_count` | `StorageValue<Felt>` | Monotonic counter; also the next `market_id` |
| `markets` | `StorageMap<Felt, Word>` | `market_id → [status, winning_outcome, close_time, outcomes_count]` |
| `outcome_pools` | `StorageMap<Felt, Felt>` | `pool_key(market_id, outcome) → cumulative wager` |
| `bets` | `StorageMap<Word, Felt>` | `bet_commitment → amount` (0 = not placed) |
| `claimed` | `StorageMap<Word, Felt>` | `bet_commitment → non-zero if claimed` |

**Storage slot IDs** (blake3 of `package_name + struct_name + field_name`, first 16 bytes):

| Field | Slot ID prefix | Slot ID suffix |
|---|---|---|
| `initialized` | `0xd6b5648a2a0d8a11` | `0x384d9df84d5dcf45` |
| `oracle_pubkey_hash` | `0x7181b423400fe62e` | `0xf019bdbe12c66e32` |
| `market_count` | `0x7b3678b7402992ae` | `0x108cbd3f2d4a157f` |
| `markets` | `0xa0c559ec5da098ba` | `0x0ce105eb5d5d86f6` |
| `bets` | `0xc26c5f27f7d59472` | `0xd638163a05638704` |
| `outcome_pools` | `0xc57fe5748b41efae` | `0xbe2174109b4b3e7a` |
| `claimed` | `0x81f7ea956cee43b3` | `0xe7456007eeeb4218` |

### Market Struct

Each market is packed into a single `Word` (four `Felt` values):

```
markets[market_id] = [status, winning_outcome, close_time, outcomes_count]
                      idx=0   idx=1             idx=2       idx=3
```

- `status`: `1` = OPEN, `2` = SETTLED (non-zero to avoid WASM `f32.const 0.0` codegen issue)
- `winning_outcome`: set at settlement; placeholder value `1` while OPEN
- `close_time`: Unix timestamp (seconds); betting closes when `block_ts >= close_time`
- `outcomes_count`: number of valid outcome indices (minimum 2)

### Parimutuel Settlement

Payout for a winning bet:

```
payout = amount × total_pool / winning_pool
```

- `total_pool`: sum of all `outcome_pools[market_id, i]` for `i in 0..outcomes_count`
- `winning_pool`: `outcome_pools[market_id, winning_outcome]`
- Arithmetic done in `u128` to prevent overflow before truncating to `u64`

---

## Poseidon2 Bet Commitment

### Motivation

On a public ZK rollup, all transaction inputs are visible to validators. Storing raw `(market_id, outcome, amount, user_secret)` on-chain would leak the bet contents. Instead, the client commits to the bet using a one-way hash.

### Commitment Construction

```rust
// Client-side (never transmitted)
let commitment: Word = Poseidon2::hash_elements(&[
    Felt::new(market_id),
    Felt::new(outcome),
    Felt::new(amount),
    Felt::new(user_secret),
]);
```

`hash_words` in the Miden SDK resolves to `Poseidon2` — the same function used by `miden::hash_words` inside the contract. The client-side `submit-place-bet` tool uses `miden_crypto::hash::poseidon2::Poseidon2::hash_elements` to guarantee consistency.

### Security Properties

| Property | Mechanism |
|---|---|
| `user_secret` never leaves client | Secret is an input to `hash_elements`; only the 32-byte digest goes on-chain |
| Commitment uniqueness | Collision resistance of Poseidon2; duplicate commitments rejected on-chain |
| Claim authentication | At claim time, user re-derives the commitment and the contract verifies `bets[commitment] != 0` |

### Claim Flow

```
Client reveals: (market_id, outcome, amount, user_secret)
    ↓
Contract: commitment = make_bet_commitment(market_id, outcome, amount, user_secret)
    ↓
Contract: stored_amount = bets.get(commitment)  // must be non-zero
    ↓
Contract: assert stored_amount == amount
    ↓
Contract: assert claimed.get(commitment) == 0   // not already claimed
    ↓
Contract: claimed.set(commitment, STATUS_SETTLED)
    ↓
Contract: return payout (Felt)
```

---

## Proc Hash System

### MAST and Procedure Identification

Miden compiles Rust contracts to WASM, then to **MAST** (Merkle Abstract Syntax Tree). Each exported procedure is identified by its MAST root — a 32-byte hash computed from the procedure's code tree.

### Call Hash Format

Transaction scripts invoke contract procedures with `call.0xHEX`. The hex value is **not** the raw MAST hash — it is byte-reversed per 8-byte chunk (little-endian per chunk):

```
MASP inspector order:  [chunk0_BE][chunk1_BE][chunk2_BE][chunk3_BE]
call.0xHEX format:     [chunk0_LE][chunk1_LE][chunk2_LE][chunk3_LE]

Each chunk_LE = u64::to_le_bytes(chunk_value).to_hex()
```

**Source:** `miden-assembly-syntax-0.22.1/src/parser/lexer.rs` — `let value = u64::from_le_bytes(felt_bytes)`

### Deriving the Call Hash

```python
# Given MASP order (from masp-inspector):
masp = "1f92867d5acabdfdece9a4eb6d0c2ae19359c1a7ae1fa54e1fc16cc6ab2d94c0"

chunks = [masp[i:i+16] for i in range(0, 64, 16)]
call_hex = "".join(bytes.fromhex(c)[::-1].hex() for c in chunks)
# → fdbdca5a7d86921fe12a0c6deba4e9ec4ea51faea7c15993c0942dabc66cc11f
```

---

## Oracle Design

### v5 Simplified Oracle

The v5 contract stores the Poseidon2 hash of the Oracle's Falcon512 public key at initialization. The oracle authority is authenticated *by key ownership* — whoever holds the wallet private key corresponding to `oracle_pubkey_hash` is the authorized oracle.

**Why full Falcon512 verification was removed (v3+):**  
`rpo_falcon512_verify` in Miden 0.14 only supports signing the *transaction commitment* (account authentication), not arbitrary oracle messages. Arbitrary-message Falcon512 signing is not yet available in the SDK. The `oracle_pubkey_hash` field is retained in storage for future activation.

### Current Trust Model

```
Oracle (off-chain) observes real-world outcome
    ↓
Oracle operator submits settle_market(market_id, winning_outcome) TX
    ↓  using the wallet that owns oracle_pubkey_hash
Contract: verifies close_time has passed (time-lock only)
Contract: updates market status to SETTLED
```

The contract enforces the time-lock (`close_time <= now`) but cannot currently verify the oracle's cryptographic signature on the outcome. This is a known limitation pending SDK support.

### Oracle Public Key Hash (v5)

Stored at initialize time (Poseidon2 hash of wallet Falcon512 pubkey):

```
[1098406756133954412, 8387568327718781019, 13259097782226059522, 6470498940017664536]
```

---

## Complete Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                     Miden Weather Market Flow                        │
└──────────────────────────────────────────────────────────────────────┘

  [Deploy]
    miden-client new-account --masp weather_market.masp --deploy
        │
        ▼
  [Initialize]  (once per contract)
    initialize(oracle_pubkey_hash: Word)
    • Sets oracle_pubkey_hash in storage
    • Sets initialized = 1 (guards re-init)
        │
        ▼
  [Create Market]
    create_market(question_hash: Word, close_time: Felt, outcomes: Felt) → market_id
    • Records market struct [OPEN, 1, close_time, outcomes] in markets[market_id]
    • Increments market_count
        │
        ▼
  [Place Bet]  (client-side commitment first)
    Client computes:
      commitment = Poseidon2([market_id, outcome, amount, user_secret])
    place_bet(market_id, outcome, amount, commitment: Word)
    • Verifies market OPEN and close_time not passed
    • Stores bets[commitment] = amount
    • Adds amount to outcome_pools[pool_key(market_id, outcome)]
        │
        ▼
  [Wait for close_time]
    block_ts >= close_time   (enforced by settle_market)
        │
        ▼
  [Settle Market]  (oracle operator)
    settle_market(market_id, winning_outcome)
    • Verifies market OPEN and close_time passed
    • Sets market status = SETTLED, winning_outcome
        │
        ▼
  [Claim Winnings]  (winning bettors)
    claim_winnings(market_id, outcome, amount, user_secret) → payout
    • Re-derives commitment from revealed inputs
    • Verifies commitment exists in bets and is unclaimed
    • Computes parimutuel payout = amount × total_pool / winning_pool
    • Marks commitment as claimed
    • Returns payout Felt
```
