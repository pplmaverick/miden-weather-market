use miden_client::account::AccountId;
use miden_client::transaction::{TransactionRequest, TransactionRequestBuilder};
use miden_client::DebugMode;
use miden_client_cli::CliClient;

const CONTRACT_ID: &str = "0x72df3f2c728125716878e6af1422af";

// v7 initialize — from package manifest (LE format via Word::to_hex)
const INIT_HASH: &str = "0x229a42d79f6d287fcf1dff1b372662e4d9d0e54984c81511db5ad51cfbf12abd";

fn build_script() -> String {
    format!(
        r#"
begin
    push.0  swap.4 drop
    push.0  swap.3 drop
    push.0  swap.2 drop
    push.0  swap.1 drop
    call.{hash}
end
"#,
        hash = INIT_HASH,
    )
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut client = CliClient::new(DebugMode::Disabled).await?;

    println!("Syncing with network...");
    client.sync_state().await?;

    let contract_id = AccountId::from_hex(CONTRACT_ID)?;
    let script = build_script();
    println!("Script:\n{}", script);

    println!("Compiling initialize script...");
    let tx_script = client.code_builder().compile_tx_script(&script)?;

    let tx_request: TransactionRequest = TransactionRequestBuilder::new()
        .custom_script(tx_script)
        .build()?;

    println!("Submitting initialize transaction...");
    let tx_id = client.submit_new_transaction(contract_id, tx_request).await?;

    println!("TX submitted! TX hash: {:#?}", tx_id);
    Ok(())
}
