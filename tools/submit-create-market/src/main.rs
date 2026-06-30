use miden_client::account::AccountId;
use miden_client::transaction::{TransactionRequest, TransactionRequestBuilder};
use miden_client::DebugMode;
use miden_client_cli::CliClient;

// v7 contract deployed on Miden testnet v0.15 (create_market is now void)
const CONTRACT_ID: &str = "0x72df3f2c728125716878e6af1422af";

// create_market — from package manifest (LE format via Word::to_hex)
const CREATE_HASH: &str =
    "0x901e1be1b97baa9d132a87350ef42624fd06cf0513a8d1cd34e884b43f2b8178";

// Binary market: outcomes=2 (outcome-0 vs outcome-1)
const OUTCOMES: u64 = 2;
const CLOSE_DELAY_SECS: u64 = 86400; // 24 hours — keeps markets open for frontend demo

fn make_script(close_time: u64) -> String {
    // v7: create_market is void (no return), so no drop after call.
    format!(
        r#"begin
    push.{outcomes}   swap.6 drop
    push.{ct}         swap.5 drop
    push.0            swap.4 drop
    push.0            swap.3 drop
    push.0            swap.2 drop
    push.0            swap.1 drop
    call.{hash}
end"#,
        outcomes = OUTCOMES,
        ct       = close_time,
        hash     = CREATE_HASH,
    )
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("=== create_market (v6 Weather Market) ===");
    println!("  contract   = {}", CONTRACT_ID);
    println!("  outcomes   = {} (outcome-0 vs outcome-1)", OUTCOMES);
    println!("  close_delay = {}s", CLOSE_DELAY_SECS);

    let mut client = CliClient::new(DebugMode::Disabled).await?;

    println!("\nSyncing...");
    let sync = client.sync_state().await?;
    let block_num = sync.block_num;

    let block_header = client
        .get_block_header_by_num(block_num)
        .await?
        .ok_or("block header not found")?;
    let block_ts   = block_header.0.timestamp() as u64;
    let close_time = block_ts + CLOSE_DELAY_SECS;

    println!("  block_num  = {}", block_num);
    println!("  block_ts   = {}", block_ts);
    println!("  close_time = {} (block_ts + {}s)", close_time, CLOSE_DELAY_SECS);
    println!("\n*** SAVE close_time={} for settle_market ***", close_time);

    let contract_id = AccountId::from_hex(CONTRACT_ID)?;
    let script      = make_script(close_time);
    println!("\nScript:\n{}", script);

    println!("Compiling create_market script...");
    let tx_script = client.code_builder().compile_tx_script(&script)?;

    let tx_request: TransactionRequest = TransactionRequestBuilder::new()
        .custom_script(tx_script)
        .build()?;

    println!("Submitting create_market transaction...");
    let tx_id = client.submit_new_transaction(contract_id, tx_request).await?;

    println!("\n=== create_market TX submitted ===");
    println!("  TX hash    = {:?}", tx_id);
    println!("  market_id  = <check market_count before this call — contract assigns sequentially>");
    println!("  close_time = {}", close_time);
    println!("  outcomes   = {}", OUTCOMES);
    println!("\nNext: run submit-place-bet <market_id> 0 100 42  (outcome=0=YES, amount=100, secret=42)");
    println!("Then wait until block_ts > {}  (~{}s)", close_time, CLOSE_DELAY_SECS);
    println!("Then: run submit-settle-market");

    Ok(())
}
