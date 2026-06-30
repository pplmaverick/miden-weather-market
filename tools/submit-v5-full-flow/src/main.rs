use miden_client::account::AccountId;
use miden_client::transaction::{TransactionRequest, TransactionRequestBuilder};
use miden_client::DebugMode;
use miden_client_cli::CliClient;
use miden_crypto::hash::poseidon2::Poseidon2;
use miden_crypto::Felt;

// ── v5 contract (deployed 2026-05-31) ────────────────────────────────────────
const CONTRACT_ID: &str = "0xf6fec93fd713d2107154ddda438e58";

// ── Bet parameters ────────────────────────────────────────────────────────────
// MARKET_ID=2: market_id=0 (run 1) and market_id=1 (run 2) both completed
// exec get_market_count confirmed market_count=2 before this run
const MARKET_ID: u64 = 2;
const OUTCOME: u64 = 1;
const AMOUNT: u64 = 1;
const USER_SECRET: u64 = 42;

// ── Close-time offset (seconds after current block_ts) ───────────────────────
// Using 90s for testnet demo; adjust to 3600 for production
const CLOSE_DELAY_SECS: u64 = 90;

// ── Proc call hashes (same as v4: identical contract code) ───────────────────
const CREATE_HASH: &str = "0x967af88a92d6caedd4fc925c575633945034d4820423f84c752e23eae338f553";
const BET_HASH:    &str = "0x5664222d2dc60614d16bc6a50b9ffa4327b6f14c15f2faffca8d884b91bf2002";
const SETTLE_HASH: &str = "0x82a863b742b7662c9302b5f549ea3ab929352f9c791bc905375185ab7d81fcf1";
const CLAIM_HASH:  &str = "0x3341aac8c50c19af589ec880a3a81929a99bb312ee5182a84b852a596e8656d2";

fn make_create_market_script(close_time: u64) -> String {
    format!(
        r#"begin
    push.2           swap.6 drop
    push.{ct}        swap.5 drop
    push.0           swap.4 drop
    push.0           swap.3 drop
    push.0           swap.2 drop
    push.0           swap.1 drop
    call.{hash}
end"#,
        ct = close_time,
        hash = CREATE_HASH,
    )
}

fn make_place_bet_script(bc: [u64; 4]) -> String {
    format!(
        r#"begin
    push.{bc3}  swap.7 drop
    push.{bc2}  swap.6 drop
    push.{bc1}  swap.5 drop
    push.{bc0}  swap.4 drop
    push.{amt}  swap.3 drop
    push.{out}  swap.2 drop
    push.{mid}  swap.1 drop
    call.{hash}
end"#,
        bc3 = bc[3],
        bc2 = bc[2],
        bc1 = bc[1],
        bc0 = bc[0],
        amt = AMOUNT,
        out = OUTCOME,
        mid = MARKET_ID,
        hash = BET_HASH,
    )
}

fn make_settle_script() -> String {
    format!(
        r#"begin
    push.{outcome}  swap.2 drop
    push.{mid}      swap.1 drop
    call.{hash}
end"#,
        outcome = OUTCOME,
        mid = MARKET_ID,
        hash = SETTLE_HASH,
    )
}

fn make_claim_script() -> String {
    format!(
        r#"begin
    push.{secret}  swap.4 drop
    push.{amt}     swap.3 drop
    push.{out}     swap.2 drop
    push.{mid}     swap.1 drop
    call.{hash}
end"#,
        secret = USER_SECRET,
        amt = AMOUNT,
        out = OUTCOME,
        mid = MARKET_ID,
        hash = CLAIM_HASH,
    )
}

fn compute_bet_commitment() -> [u64; 4] {
    let elements = [
        Felt::new(MARKET_ID),
        Felt::new(OUTCOME),
        Felt::new(AMOUNT),
        Felt::new(USER_SECRET),
    ];
    let digest = Poseidon2::hash_elements(&elements);
    let mut bc = [0u64; 4];
    for (i, f) in digest.iter().enumerate() {
        bc[i] = f.as_canonical_u64();
    }
    bc
}

async fn submit_tx(
    client: &mut CliClient,
    contract_id: AccountId,
    script: &str,
    label: &str,
) -> Result<String, Box<dyn std::error::Error>> {
    println!("\n[{}] Compiling script...", label);
    let tx_script = client.code_builder().compile_tx_script(script)?;
    let tx_request: TransactionRequest = TransactionRequestBuilder::new()
        .custom_script(tx_script)
        .build()?;
    println!("[{}] Submitting TX...", label);
    let tx_id = client.submit_new_transaction(contract_id, tx_request).await?;
    let hash = format!("{:?}", tx_id);
    println!("[{}] TX hash: {}", label, hash);
    Ok(hash)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("=== Miden Weather Market v5 — Full Flow ===");
    println!("Contract: {}", CONTRACT_ID);
    println!("bet: market_id={MARKET_ID}, outcome={OUTCOME}, amount={AMOUNT}, secret={USER_SECRET}");

    let mut client = CliClient::new(DebugMode::Disabled).await?;
    let contract_id = AccountId::from_hex(CONTRACT_ID)?;

    // ── Step 0: sync + import v5 from network ─────────────────────────────────
    println!("\n[Step 0] Syncing...");
    let sync = client.sync_state().await?;
    let current_block = sync.block_num;
    println!("  block_num = {}", current_block);

    // Get block timestamp for close_time calculation
    let block_header = client.get_block_header_by_num(current_block).await?
        .ok_or("block header not found")?;
    let block_ts = block_header.0.timestamp() as u64;
    let close_time = block_ts + CLOSE_DELAY_SECS;
    println!("  block_ts  = {block_ts}");
    println!("  close_time= {close_time} (+{CLOSE_DELAY_SECS}s)");

    println!("\n[Step 0] Importing v5 contract from network...");
    if let Err(e) = client.import_account_by_id(contract_id).await {
        println!("  (already in store or error: {:?})", e);
    } else {
        println!("  imported OK");
        client.sync_state().await?;
    }

    // ── Step 1: create_market ────────────────────────────────────────────────
    // (initialize already done in v5 run-1; market_count confirmed=1 via exec)
    let create_script = make_create_market_script(close_time);
    let tx1 = submit_tx(&mut client, contract_id, &create_script, "create_market").await?;

    // ── Step 2: place_bet (Poseidon2 commitment) ──────────────────────────────
    let bc = compute_bet_commitment();
    println!("\n  bet_commitment (Poseidon2): [{}, {}, {}, {}]", bc[0], bc[1], bc[2], bc[3]);
    let bet_script = make_place_bet_script(bc);
    let tx2 = submit_tx(&mut client, contract_id, &bet_script, "place_bet").await?;

    // ── Step 3: wait for close_time ───────────────────────────────────────────
    println!("\n[Step 3] Waiting for block_ts >= close_time ({close_time})...");
    loop {
        tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
        let sync = client.sync_state().await?;
        let bh = client.get_block_header_by_num(sync.block_num).await?
            .ok_or("block header not found")?;
        let ts = bh.0.timestamp() as u64;
        println!("  block_num={}, block_ts={ts}, close_time={close_time}", sync.block_num);
        if ts >= close_time {
            println!("  close_time reached! proceeding to settle...");
            break;
        }
    }

    // ── Step 4: settle_market ─────────────────────────────────────────────────
    println!("\n[Step 4] Refreshing account state from network before settle...");
    client.sync_state().await?;
    if let Err(e) = client.import_account_by_id(contract_id).await {
        println!("  (refresh note: {:?})", e);
    } else {
        println!("  refreshed OK");
        client.sync_state().await?;
    }

    let settle_script = make_settle_script();
    let tx3 = submit_tx(&mut client, contract_id, &settle_script, "settle_market").await?;

    // ── Step 5: claim_winnings ────────────────────────────────────────────────
    println!("\n[Step 5] Refreshing account state after settle...");
    client.sync_state().await?;
    if let Err(e) = client.import_account_by_id(contract_id).await {
        println!("  (refresh note: {:?})", e);
    } else {
        println!("  refreshed OK");
        client.sync_state().await?;
    }

    let claim_script = make_claim_script();
    let tx4 = submit_tx(&mut client, contract_id, &claim_script, "claim_winnings").await?;

    // ── Final report ──────────────────────────────────────────────────────────
    println!("\n╔══════════════════════════════════════════════════════════════╗");
    println!("║    Miden Weather Market v5 — Run 3 TX Hash Report           ║");
    println!("╠══════════════════════════════════════════════════════════════╣");
    println!("║ Contract   : {}", CONTRACT_ID);
    println!("║ market_id  : {} (market_count was 2 before this run)", MARKET_ID);
    println!("║ close_time : {close_time} (block_ts + {CLOSE_DELAY_SECS}s)");
    println!("║ outcome    : {} / secret : {}", OUTCOME, USER_SECRET);
    println!("╠══════════════════════════════════════════════════════════════╣");
    println!("║ 1. Create Market : {tx1}");
    println!("║ 2. Place Bet     : {tx2}");
    println!("║ 3. Settle Market : {tx3}");
    println!("║ 4. Claim Winnings: {tx4}");
    println!("╚══════════════════════════════════════════════════════════════╝");

    Ok(())
}
