use miden_crypto::hash::poseidon2::Poseidon2;
use miden_crypto::hash::rpo::Rpo256;
use miden_crypto::Felt;
use std::env;

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 5 {
        eprintln!("usage: commitment-helper <market_id> <outcome> <amount> <user_secret> [--debug]");
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
    let debug       = args.get(5).map(|s| s == "--debug").unwrap_or(false);

    let elements = [
        Felt::new(market_id),
        Felt::new(outcome),
        Felt::new(amount),
        Felt::new(user_secret),
    ];

    // RPO256 — likely matches contract's hash_words (Miden native hash)
    let rpo_digest  = Rpo256::hash_elements(&elements);
    // Poseidon2 — alternative (submit-place-bet/main.rs uses this)
    let p2_digest   = Poseidon2::hash_elements(&elements);

    if debug {
        let rpo_parts: Vec<String> = rpo_digest.iter().map(|f| f.as_canonical_u64().to_string()).collect();
        let p2_parts:  Vec<String> = p2_digest.iter().map(|f| f.as_canonical_u64().to_string()).collect();
        eprintln!("RPO256   : {}", rpo_parts.join(","));
        eprintln!("Poseidon2: {}", p2_parts.join(","));
        eprintln!("known-ok : 10812862698675043068,8483794432572135953,13865444810042079354,11830695914661148006");
    }

    // Output RPO256 (matches contract's hash_words)
    let parts: Vec<String> = rpo_digest.iter()
        .map(|f| f.as_canonical_u64().to_string())
        .collect();
    println!("{}", parts.join(","));
}
