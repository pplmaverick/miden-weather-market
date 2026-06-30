use std::{env, fs};
use miden_core::serde::Deserializable;
use miden_mast_package::{Package, PackageExport};

fn word_to_hex(word: &[miden_core::Felt; 4]) -> String {
    word.iter()
        .flat_map(|f| f.as_canonical_u64().to_be_bytes())
        .map(|b| format!("{:02x}", b))
        .collect()
}

fn word_to_hex_reversed(word: &[miden_core::Felt; 4]) -> String {
    word.iter().rev()
        .flat_map(|f| f.as_canonical_u64().to_be_bytes())
        .map(|b| format!("{:02x}", b))
        .collect()
}

fn main() {
    let path = env::args()
        .nth(1)
        .unwrap_or_else(|| {
            "../../weather-market/target/miden/release/weather_market.masp".to_string()
        });

    let bytes = fs::read(&path).expect("Failed to read .masp file");
    let pkg = Package::read_from_bytes(&bytes).expect("Failed to deserialize Package");

    println!("Package: {}", pkg.name);
    println!("Version: {}", pkg.version);

    let pkg_digest = pkg.digest();
    println!("Package digest (MASP order): 0x{}", word_to_hex(&pkg_digest));
    println!("Package digest (Miden order): 0x{}", word_to_hex_reversed(&pkg_digest));

    println!("\nExported procedures:");
    println!("{:<60} {:>66}", "Name", "Digest (MASP order)");
    println!("{:-<60} {:->66}", "", "");
    for export in pkg.manifest.exports() {
        if let PackageExport::Procedure(proc) = export {
            let hex_masp = word_to_hex(&proc.digest);
            let hex_miden = word_to_hex_reversed(&proc.digest);
            let name = format!("{}", proc.path);
            println!("  {}", name);
            println!("    MASP  order: 0x{}", hex_masp);
            println!("    Miden order: 0x{}", hex_miden);
        }
    }
}
