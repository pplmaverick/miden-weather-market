// Compare actual MAST roots in v2 vs v3 to find unique entries
use miden_client::account::AccountCode;
use miden_client::utils::Deserializable;
use miden_client::assembly::MastNodeExt;
use std::collections::HashSet;
use std::fs;

fn word_to_miden_hex(word: &[u64; 4]) -> String {
    word.iter().rev()
        .flat_map(|f| f.to_be_bytes())
        .map(|b| format!("{:02x}", b))
        .collect()
}

fn get_actual_roots(code: &AccountCode) -> HashSet<String> {
    let forest = code.mast();
    forest.procedure_roots().iter().map(|node_id| {
        let digest = forest[*node_id].digest();
        let u64s: [u64; 4] = core::array::from_fn(|j| digest[j].as_canonical_u64());
        word_to_miden_hex(&u64s)
    }).collect()
}

fn main() {
    let v2_bytes = fs::read("/tmp/v2_code.blob").expect("v2");
    let v3_bytes = fs::read("/tmp/v3_deployed_code.blob").expect("v3");
    let v2 = AccountCode::read_from_bytes(&v2_bytes).expect("decode v2");
    let v3 = AccountCode::read_from_bytes(&v3_bytes).expect("decode v3");

    let v2_roots = get_actual_roots(&v2);
    let v3_roots = get_actual_roots(&v3);

    println!("v2 actual roots: {}", v2_roots.len());
    println!("v3 actual roots: {}", v3_roots.len());

    println!("\n=== In v2 but NOT in v3 (removed procs) ===");
    let mut only_v2: Vec<&str> = v2_roots.iter()
        .filter(|h| !v3_roots.contains(*h))
        .map(|s| s.as_str())
        .collect();
    only_v2.sort();
    for h in &only_v2 {
        println!("  0x{}", h);
    }

    println!("\n=== In v3 but NOT in v2 (added procs) ===");
    let mut only_v3: Vec<&str> = v3_roots.iter()
        .filter(|h| !v2_roots.contains(*h))
        .map(|s| s.as_str())
        .collect();
    only_v3.sort();
    for h in &only_v3 {
        println!("  0x{}", h);
    }

    // Also check: are the old working hashes in either set?
    println!("\n=== Old working hashes presence ===");
    let working = [
        ("settle old", "375185ab7d81fcf129352f9c791bc9059302b5f549ea3ab982a863b742b7662c"),
        ("place old",  "ca8d884b91bf200227b6f14c15f2faffd16bc6a50b9ffa435664222d2dc60614"),
        ("create old", "f693e81f0c39bb7ff0c39bb7f0c39bb75c92fcd4edcad6928af87a9692da8dad"),
    ];
    for (name, hex) in &working {
        println!("  {} in v2: {} | in v3: {}", name, v2_roots.contains(*hex), v3_roots.contains(*hex));
    }
}
