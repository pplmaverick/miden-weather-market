use miden_client::account::AccountId;
use miden_client::transaction::{TransactionRequest, TransactionRequestBuilder};
use miden_client::DebugMode;
use miden_client_cli::CliClient;
use miden_crypto::hash::rpo::Rpo256; // must match contract's hash_words (RPO256, not Poseidon2)
use miden_crypto::Felt;
use std::env;

// v5 contract (deployed 2026-05-31)
const CONTRACT_ID: &str = "0xf6fec93fd713d2107154ddda438e58";

// place-bet proc hash (call.0x... format, LE per 8-byte chunk)
const BET_HASH: &str = "0x5664222d2dc60614d16bc6a50b9ffa4327b6f14c15f2faffca8d884b91bf2002";

fn compute_bet_commitment(market_id: u64, outcome: u64, amount: u64, user_secret: u64) -> [u64; 4] {
    let elements = [
        Felt::new(market_id),
        Felt::new(outcome),
        Felt::new(amount),
        Felt::new(user_secret),
    ];
    let digest = Rpo256::hash_elements(&elements);
    let mut bc = [0u64; 4];
    for (i, felt) in digest.iter().enumerate() {
        bc[i] = felt.as_canonical_u64();
    }
    bc
}

fn build_script(market_id: u64, outcome: u64, amount: u64, bc: [u64; 4]) -> String {
    format!(
        r#"
begin
    push.{bc3}  swap.7 drop
    push.{bc2}  swap.6 drop
    push.{bc1}  swap.5 drop
    push.{bc0}  swap.4 drop
    push.{amt}  swap.3 drop
    push.{out}  swap.2 drop
    push.{mid}  swap.1 drop
    call.{hash}
end
"#,
        bc3  = bc[3],
        bc2  = bc[2],
        bc1  = bc[1],
        bc0  = bc[0],
        amt  = amount,
        out  = outcome,
        mid  = market_id,
        hash = BET_HASH,
    )
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();
    if args.len() != 5 {
        eprintln!("usage: submit-place-bet <market_id> <outcome> <amount> <user_secret>");
        eprintln!("  market_id   : u64 (e.g. 0)");
        eprintln!("  outcome     : u64 (1 = Yes, 2 = No)");
        eprintln!("  amount      : u64 (token units)");
        eprintln!("  user_secret : u64 — SAVE THIS for claim_winnings");
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

    let bc = compute_bet_commitment(market_id, outcome, amount, user_secret);

    println!("=== place_bet parameters ===");
    println!("  contract    = {}", CONTRACT_ID);
    println!("  market_id   = {}", market_id);
    println!("  outcome     = {}", outcome);
    println!("  amount      = {}", amount);
    println!("  user_secret = {}  ← SAVE THIS for claim_winnings", user_secret);
    println!(
        "  bet_commitment (RPO256) = [{}, {}, {}, {}]",
        bc[0], bc[1], bc[2], bc[3]
    );

    let mut client = CliClient::new(DebugMode::Disabled).await?;

    println!("\nSyncing with network...");
    client.sync_state().await?;

    let contract_id = AccountId::from_hex(CONTRACT_ID)?;
    let script = build_script(market_id, outcome, amount, bc);

    println!("Compiling place_bet script...");
    let tx_script = client.code_builder().compile_tx_script(&script)?;

    let tx_request: TransactionRequest = TransactionRequestBuilder::new()
        .custom_script(tx_script)
        .build()?;

    println!("Submitting place_bet transaction...");
    let tx_id = client.submit_new_transaction(contract_id, tx_request).await?;

    println!("TX submitted! TX hash: {:#?}", tx_id);
    Ok(())
}
