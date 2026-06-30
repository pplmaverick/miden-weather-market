use miden_client::vm::Package;
use miden_client::Deserializable;
use std::path::Path;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let masp_path = Path::new(
        "/Users/pplmaverick/miden-weather-market/weather-market/target/midenc/miden/release/weather-market.masp"
    );

    println!("Loading package from: {}", masp_path.display());
    let bytes = std::fs::read(masp_path)?;
    let package = Package::read_from_bytes(&bytes)?;

    println!("\nExported procedures (use these hashes for call.0xHASH):");
    println!("{:-<70}", "");

    let library = &*package.mast;
    for module_info in library.module_infos() {
        let module_path = module_info.path();
        for (_idx, proc_info) in module_info.procedures() {
            let name = &proc_info.name;
            if let Some(digest) = module_info.get_procedure_digest_by_name(name.as_str()) {
                println!("{}::{}", module_path, name);
                println!("  call.0xHASH = {}", digest.to_hex());
            }
        }
    }

    Ok(())
}
