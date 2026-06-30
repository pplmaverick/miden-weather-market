use miden_client::account::AccountId;
use miden_client::transaction::{TransactionRequest, TransactionRequestBuilder};
use miden_client::DebugMode;
use miden_client_cli::CliClient;
use std::env;

// v7 contract deployed on Miden testnet v0.15
const CONTRACT_ID: &str = "0x72df3f2c728125716878e6af1422af";

// settle_market — from package manifest (LE format via Word::to_hex)
const SETTLE_HASH: &str =
    "0xdf071bb886e6fa55466026caa27d1a2e3ba0d93e982c02d0055a4025a033dc20";

fn make_script(market_id: u64, winning_outcome: u64) -> String {
    format!(
        r#"begin
    push.{wo}  swap.2 drop
    push.{mid} swap.1 drop
    call.{hash}
end"#,
        wo   = winning_outcome,
        mid  = market_id,
        hash = SETTLE_HASH,
    )
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();
    if args.len() != 3 {
        eprintln!("usage: submit-settle-market <market_id> <winning_outcome>");
        eprintln!("  e.g. submit-settle-market 0 0");
        eprintln!("  NOTE: only call after close_time has passed on the testnet!");
        std::process::exit(1);
    }

    let parse = |s: &str, name: &str| -> u64 {
        s.parse::<u64>().unwrap_or_else(|_| {
            eprintln!("error: {} must be a u64, got '{}'", name, s);
            std::process::exit(1);
        })
    };

    let market_id      = parse(&args[1], "market_id");
    let winning_outcome = parse(&args[2], "winning_outcome");

    println!("=== settle_market (v6 Weather Market) ===");
    println!("  contract        = {}", CONTRACT_ID);
    println!("  market_id       = {}", market_id);
    println!("  winning_outcome = {}", winning_outcome);

    let mut client = CliClient::new(DebugMode::Disabled).await?;

    println!("\nSyncing...");
    let sync     = client.sync_state().await?;
    let block_num = sync.block_num;
    let block_header = client
        .get_block_header_by_num(block_num)
        .await?
        .ok_or("block header not found")?;
    let block_ts = block_header.0.timestamp() as u64;
    println!("  current block_ts = {} (close_time must be <= this)", block_ts);

    let contract_id = AccountId::from_hex(CONTRACT_ID)?;
    let script      = make_script(market_id, winning_outcome);
    println!("\nScript:\n{}", script);

    println!("Compiling settle_market script...");
    let tx_script = client.code_builder().compile_tx_script(&script)?;

    let tx_request: TransactionRequest = TransactionRequestBuilder::new()
        .custom_script(tx_script)
        .build()?;

    println!("Submitting settle_market transaction...");
    let tx_id = client.submit_new_transaction(contract_id, tx_request).await?;

    println!("\n=== settle_market TX submitted ===");
    println!("  TX hash         = {:?}", tx_id);
    println!("  market_id       = {}", market_id);
    println!("  winning_outcome = {}", winning_outcome);
    println!("\nNext: run submit-claim-winnings 0 0 100 42");

    Ok(())
}
