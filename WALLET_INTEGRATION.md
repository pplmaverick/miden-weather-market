# Wallet Integration — Stage 2 Investigation

## Summary

Stage 2 attempted to send bets directly from the browser wallet to the deployed Miden
Weather Market contract. After extensive investigation, this was found to be architecturally
blocked by a Miden v0.15 SDK limitation. The adopted solution routes on-chain submissions
through the Miden CLI while keeping all client-side computation (Poseidon2 commitment) in
the browser.

---

## What Was Attempted

**SDK versions:**
- `@miden-sdk/miden-sdk` 0.15.3
- `@miden-sdk/miden-wallet-adapter` 0.15.1

**Approach:**
1. Initialized `MidenClient.createMock()` to bootstrap the WASM module (chain-agnostic)
2. Used `getWasmOrThrow()` + `wasm.Poseidon2.hashElements(felts)` to compute the bet commitment locally in browser WASM — this worked correctly
3. Compiled a MASM transaction script using `AccountComponent.compile({ code: masm })`
4. Built a `TransactionRequest` via `TransactionRequestBuilder`
5. Wrapped it in `new CustomTransaction(walletAddress, CONTRACT_ID, txRequest)`
6. Called `requestTransaction(txObj)` via `@miden-sdk/miden-wallet-adapter`
7. Awaited `waitForTransaction(pendingId, 180000)` for on-chain confirmation

---

## Errors Encountered (in order)

### Error 1 — Wrong `address` field
```
Error: account data wasn't found for account id 0x72df3f2c728125716878e6af1422af
```
**Cause:** `CustomTransaction.address` was set to `CONTRACT_ID`. The extension only
manages user-owned accounts; setting address to the contract triggers an internal lookup
failure.

**Fix:** Reverted to `new CustomTransaction(walletAddress, CONTRACT_ID, txRequest)` where
`walletAddress` is the user's connected wallet address.

---

### Error 2 — MAST forest limitation (ROOT CAUSE)
```
Error: failed to execute transaction:
  procedure with root digest 0x7ed76d95ac446cbaf23785cf3f581afefb81bd02e74b6e9f1758446c917e000f
  could not be found
```
`0x7ed76d95...` is the `place_bet` procedure hash from the deployed contract package manifest.

---

## Root Cause Analysis

**Miden MAST forest:** Every Miden transaction executes within a "MAST forest" — the set of
all Merkelized Abstract Syntax Trees that the execution engine can resolve `call.HASH`
instructions against. For a transaction to call into a contract procedure, that contract's
MAST must be present in the forest at execution time.

**Browser wallet behavior (v0.15):** The Miden Pioneer wallet extension builds the MAST
forest from the user's own account code only. When the transaction script contains
`call.0x7ed76d95...` (the `place_bet` procedure of the Weather Market contract), the
extension's MAST forest does not include it → execution fails.

**Rust CLI behavior:** The `submit-place-bet` tool calls `sync_state()` before building
the transaction. `sync_state()` fetches the contract account's full MAST code from the
Miden node RPC. This populates the local MAST forest, making cross-account procedure calls
resolvable.

**Conclusion:** This is not a code bug. It is an architectural limitation of Miden v0.15
browser wallet: the extension has no mechanism to fetch and load external account MAST
forests on demand.

---

## What Still Works

| Feature | Status |
|---|---|
| Wallet connection (Stage 1) | ✅ Works |
| Wallet address display | ✅ Works |
| Poseidon2 commitment in browser WASM | ✅ Works |
| 3 markets deployed on Miden testnet | ✅ Works |
| CLI submission via `submit-place-bet` | ✅ Works |
| Oracle settlement pipeline | ✅ Works |

---

## Adopted Solution — CLI Fallback

The frontend computes the Poseidon2 commitment locally in browser WASM and displays a
fully pre-filled CLI command for the user to run.

**Commitment computation (browser):**
```typescript
const sdk = await import('@miden-sdk/miden-sdk')
await sdk.MidenClient.createMock()  // bootstrap WASM, chain-agnostic
const wasm = await sdk.getWasmOrThrow()
const felts = new wasm.FeltArray([
  new wasm.Felt(BigInt(marketId)),
  new wasm.Felt(BigInt(outcome)),
  new wasm.Felt(BigInt(amount)),
  new wasm.Felt(BigInt(userSecret)),
])
const digest = wasm.Poseidon2.hashElements(felts)
const bc = digest.toU64s()
const commitment = `[${bc[0]}, ${bc[1]}, ${bc[2]}, ${bc[3]}]`
```

**On-chain submission (CLI):**
```bash
cd ~/miden-weather-market
./tools/submit-place-bet/target/release/submit-place-bet <market_id> <outcome> <amount> <user_secret>

# outcome: 0 = YES (above threshold), 1 = NO (at/below threshold)
```

This preserves the zero-knowledge privacy properties — the commitment is computed
client-side, never transmitted to any server, and the secret stays local.

---

## Why Not a VPS Relay?

A relay server would receive the user's `user_secret` to compute the commitment
server-side. This breaks the privacy model (secret leaves the user's device) and
introduces a centralized trust assumption that undermines the ZK narrative.

---

## Future Path

Miden SDK support for loading foreign account MAST forests is tracked as a future
enhancement. Once available, the browser wallet flow becomes:

1. Extension fetches target contract MAST via RPC
2. Includes it in the transaction's MAST forest
3. `call.HASH` resolves successfully

When this lands in a future SDK version, `Markets.tsx` can be updated to attempt
`requestTransaction()` before the CLI fallback path, without changing any other logic.

---

## Affected Files

- `frontend/src/pages/Markets.tsx` — simplified: skips wallet TX attempt, always computes commitment + shows pre-filled CLI command
- `tools/submit-place-bet/src/main.rs` — unchanged; this is the working on-chain submission path
- `cli/miden_cli.py` — Python wrapper (note: help text bug — says `1=Yes, 2=No`; actual encoding is `0=YES, 1=NO` matching contract)

---

## SDK Notes

- `@miden-sdk/miden-wallet-adapter` `requestTransaction()` returns the transaction UUID as a raw `string` (not `{ transactionId: string }`). Extracting `.transactionId` from a string gives `undefined`.
- `waitForTransaction(uuid, timeout)` polls for on-chain inclusion; throws on timeout.
- `TransactionRequest` contains only: compiled script, advice map, auth args — no nonce or account state. The extension fetches those from RPC.
- `CustomTransaction(address, recipientAddress, txRequest)`: `address` must be a user wallet the extension manages.
