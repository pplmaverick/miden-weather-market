use miden_client::account::AccountId;
use miden_client::transaction::{TransactionRequest, TransactionRequestBuilder};
use miden_client::DebugMode;
use miden_client_cli::CliClient;
use std::env;

// v6 contract deployed on Miden testnet v0.15
// v7 contract deployed on Miden testnet v0.15 (claim_winnings is now void)
const CONTRACT_ID: &str = "0x72df3f2c728125716878e6af1422af";

// claim_winnings — from package manifest (LE format via Word::to_hex)
const CLAIM_HASH: &str =
    "0xa8a32516f30b214fefcb49527415d92430b5b2daf13a7773577350d640ceea0a";

fn make_script(market_id: u64, outcome: u64, amount: u64, user_secret: u64) -> String {
    // v7: claim_winnings is now void (no return value)
    format!(
        r#"begin
    push.{sec}  swap.4 drop
    push.{amt}  swap.3 drop
    push.{out}  swap.2 drop
    push.{mid}  swap.1 drop
    call.{hash}
end"#,
        sec  = user_secret,
        amt  = amount,
        out  = outcome,
        mid  = market_id,
        hash = CLAIM_HASH,
    )
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();
    if args.len() != 5 {
        eprintln!("usage: submit-claim-winnings <market_id> <outcome> <amount> <user_secret>");
        eprintln!("  e.g. submit-claim-winnings 0 0 100 42");
        std::process::exit(1);
    }

    let parse = |s: &str, name: &str| -> u64 {
        s.parse::<u64>().unwrap_or_else(|_| {
            eprintln!("error: {} must be a u64, got '{}'", name, s);
            std::process::exit(1);
        })
    };

    let market_id   = parse(&args[1], "market_id");
    let outcome     = parse(&args[2], "outcome");
    let amount      = parse(&args[3], "amount");
    let user_secret = parse(&args[4], "user_secret");

    println!("=== claim_winnings (v6 Weather Market) ===");
    println!("  contract    = {}", CONTRACT_ID);
    println!("  market_id   = {}", market_id);
    println!("  outcome     = {}", outcome);
    println!("  amount      = {}", amount);
    println!("  user_secret = {}", user_secret);

    let mut client = CliClient::new(DebugMode::Disabled).await?;

    println!("\nSyncing...");
    client.sync_state().await?;

    let contract_id = AccountId::from_hex(CONTRACT_ID)?;
    let script      = make_script(market_id, outcome, amount, user_secret);
    println!("\nScript:\n{}", script);

    println!("Compiling claim_winnings script...");
    let tx_script = client.code_builder().compile_tx_script(&script)?;

    let tx_request: TransactionRequest = TransactionRequestBuilder::new()
        .custom_script(tx_script)
        .build()?;

    println!("Submitting claim_winnings transaction...");
    let tx_id = client.submit_new_transaction(contract_id, tx_request).await?;

    println!("\n=== claim_winnings TX submitted ===");
    println!("  TX hash     = {:?}", tx_id);
    println!("  market_id   = {}", market_id);
    println!("  outcome     = {} (winning)", outcome);
    println!("  amount      = {}", amount);
    println!("  payout      = sole bettor → full pool = {}", amount);

    Ok(())
}
