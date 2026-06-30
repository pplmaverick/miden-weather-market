use miden_client::account::AccountId;
use miden_client::transaction::{TransactionRequest, TransactionRequestBuilder};
use miden_client::DebugMode;
use miden_client_cli::CliClient;
use miden_crypto::hash::poseidon2::Poseidon2;
use miden_crypto::Felt;
use std::env;

// v7 contract deployed on Miden testnet v0.15
const CONTRACT_ID: &str = "0x72df3f2c728125716878e6af1422af";

// place_bet — from package manifest (LE format via Word::to_hex)
const BET_HASH: &str =
    "0x7ed76d95ac446cbaf23785cf3f581afefb81bd02e74b6e9f1758446c917e000f";

fn f(v: u64) -> Felt {
    Felt::new(v).expect("valid field element")
}

fn compute_bet_commitment(market_id: u64, outcome: u64, amount: u64, user_secret: u64) -> [u64; 4] {
    let elements = [f(market_id), f(outcome), f(amount), f(user_secret)];
    let digest   = Poseidon2::hash_elements(&elements);
    let mut bc   = [0u64; 4];
    for (i, felt) in digest.iter().enumerate() {
        bc[i] = felt.as_canonical_u64();
    }
    bc
}

fn build_script(market_id: u64, outcome: u64, amount: u64, bc: [u64; 4]) -> String {
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
        eprintln!("  e.g. submit-place-bet 0 0 100 42");
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

    println!("=== place_bet (v6 Weather Market) ===");
    println!("  contract    = {}", CONTRACT_ID);
    println!("  market_id   = {}", market_id);
    println!("  outcome     = {}", outcome);
    println!("  amount      = {}", amount);
    println!("  user_secret = {}  ← KEEP THIS for claim_winnings", user_secret);
    println!(
        "  bet_commitment = [{}, {}, {}, {}]",
        bc[0], bc[1], bc[2], bc[3]
    );

    let mut client = CliClient::new(DebugMode::Disabled).await?;

    println!("\nSyncing with network...");
    client.sync_state().await?;

    let contract_id = AccountId::from_hex(CONTRACT_ID)?;
    let script      = build_script(market_id, outcome, amount, bc);
    println!("\nScript:\n{}", script);

    println!("Compiling place_bet script...");
    let tx_script = client.code_builder().compile_tx_script(&script)?;

    let tx_request: TransactionRequest = TransactionRequestBuilder::new()
        .custom_script(tx_script)
        .build()?;

    println!("Submitting place_bet transaction...");
    let tx_id = client.submit_new_transaction(contract_id, tx_request).await?;

    println!("\n=== place_bet TX submitted ===");
    println!("  TX hash = {:?}", tx_id);
    println!("  market_id={} outcome={} amount={} secret={}", market_id, outcome, amount, user_secret);

    Ok(())
}
