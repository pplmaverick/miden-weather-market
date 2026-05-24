#![no_std]
#![feature(alloc_error_handler)]

extern crate alloc;

use miden::{
    Felt, Word,
    StorageMap, StorageValue,
    component,
    hash_words,
    emit_falcon_sig_to_stack,
    rpo_falcon512_verify,
};

// ── Market status ─────────────────────────────────────────────
// Non-zero values: Miden WASM backend cannot represent f32.const 0.0
const STATUS_OPEN:    u64 = 1;
const STATUS_SETTLED: u64 = 2;

// ── Word slot indices for the `markets` StorageMap ────────────
// markets[market_id] = Word[ status, winning_outcome, close_time, outcomes_count ]
const IDX_STATUS:  usize = 0;
const IDX_WIN_OUT: usize = 1;
const IDX_CLOSE:   usize = 2;
const IDX_OUTS:    usize = 3;

// ── Storage layout ────────────────────────────────────────────
#[component]
struct WeatherMarketContract {
    // Global counter; also the next market_id
    #[storage()]
    market_count: StorageValue<Felt>,

    // Non-zero once initialize() has been called; guards re-initialisation
    #[storage()]
    initialized: StorageValue<Felt>,

    // Poseidon2 hash of the Oracle's Falcon512 public key.
    // Stored at initialise time; used by settle_market to verify Oracle signatures.
    // The full public key is provided off-chain via the advice provider.
    #[storage()]
    oracle_pubkey_hash: StorageValue<Word>,

    // market_id → [status, winning_outcome, close_time, outcomes_count]
    #[storage()]
    markets: StorageMap<Felt, Word>,

    // pool_key(market_id, outcome) → cumulative bet amount for that outcome
    #[storage()]
    outcome_pools: StorageMap<Felt, Felt>,

    // bet_commitment → amount  (0 = not placed, >0 = placed)
    #[storage()]
    bets: StorageMap<Word, Felt>,

    // bet_commitment → non-zero if winnings already claimed
    // Separate map so we never write Felt(0) from source code
    #[storage()]
    claimed: StorageMap<Word, Felt>,
}

// ── Helpers ───────────────────────────────────────────────────

fn pool_key(market_id: Felt, outcome: u32) -> Felt {
    market_id * Felt::new(256) + Felt::new(outcome as u64)
}

fn make_bet_commitment(
    market_id: Felt,
    outcome: u32,
    amount: Felt,
    user_secret: Felt,
) -> Word {
    let data = Word::new([market_id, Felt::new(outcome as u64), amount, user_secret]);
    Word::from(hash_words(&[data]))
}

/// Compute the settle message that the Oracle must sign.
///
/// msg = Poseidon2_hash( [market_id, winning_outcome, 0, 0] )
///
/// Both fields are padded to a full Word so the digest is unambiguous.
fn make_settle_msg(market_id: Felt, winning_outcome: Felt) -> Word {
    let data = Word::new([market_id, winning_outcome, Felt::new(0), Felt::new(0)]);
    Word::from(hash_words(&[data]))
}

// ── Contract methods ──────────────────────────────────────────
#[component]
impl WeatherMarketContract {

    // ── Initialisation ────────────────────────────────────────
    //
    // oracle_pubkey_hash = Poseidon2_hash(oracle_falcon512_public_key)
    //
    // The caller must supply the hash of the Oracle's Falcon512 public key.
    // The full public key is never stored on-chain; only its hash is committed.
    // Call once at deployment; panics if already initialised.
    pub fn initialize(&mut self, oracle_pubkey_hash: Word) {
        assert!(
            self.initialized.get().as_canonical_u64() == 0,
            "already initialized"
        );
        self.oracle_pubkey_hash.set(oracle_pubkey_hash);
        self.initialized.set(Felt::new(STATUS_OPEN));
    }

    // ── Create market ─────────────────────────────────────────
    //
    // question_hash : Poseidon hash of the question text (text stored off-chain)
    // close_time    : block timestamp after which betting closes
    // outcomes      : number of valid outcomes (>= 2)
    // returns       : market_id
    pub fn create_market(
        &mut self,
        question_hash: Word,
        close_time: Felt,
        outcomes: Felt,
    ) -> Felt {
        let _ = question_hash;
        assert!(outcomes.as_canonical_u64() >= 2, "need >= 2 outcomes");

        let id = self.market_count.get();
        self.markets.set(
            id,
            Word::new([
                Felt::new(STATUS_OPEN),
                Felt::new(STATUS_OPEN), // winning_outcome placeholder; overwritten at settle
                close_time,
                outcomes,
            ]),
        );
        self.market_count.set(id + Felt::new(1));
        id
    }

    // ── Place bet ─────────────────────────────────────────────
    //
    // market_id      : target market
    // outcome        : which result to bet on (0 .. outcomes-1)
    // amount         : tokens wagered (> 0)
    // bet_commitment : commitment computed client-side:
    //                  make_bet_commitment(market_id, outcome, amount, user_secret)
    pub fn place_bet(
        &mut self,
        market_id: Felt,
        outcome: Felt,
        amount: Felt,
        bet_commitment: Word,
    ) {
        let market = self.markets.get(market_id);
        assert!(
            market[IDX_STATUS].as_canonical_u64() == STATUS_OPEN,
            "market not open"
        );

        let now   = miden::tx::get_block_timestamp().as_canonical_u64();
        let close = market[IDX_CLOSE].as_canonical_u64();
        assert!(close > now, "market already closed");

        let max_out   = market[IDX_OUTS].as_canonical_u64() as u32;
        let outcome_u = outcome.as_canonical_u64() as u32;
        assert!(outcome_u < max_out, "invalid outcome");
        assert!(amount.as_canonical_u64() > 0, "amount must be > 0");
        assert!(
            self.bets.get(bet_commitment).as_canonical_u64() == 0,
            "commitment already used"
        );

        self.bets.set(bet_commitment, amount);

        let key  = pool_key(market_id, outcome_u);
        let pool = self.outcome_pools.get(key);
        self.outcome_pools.set(key, pool + amount);
    }

    // ── Settle market ─────────────────────────────────────────
    //
    // Only callable by the holder of the Oracle's Falcon512 secret key.
    // Can only be called after close_time has passed.
    //
    // Security model (Falcon512 / advice-provider pattern):
    //   1. Oracle computes msg = Poseidon2_hash([market_id, winning_outcome, 0, 0])
    //   2. Oracle signs msg with their Falcon512 secret key → σ
    //   3. Oracle adds σ to the transaction's advice provider (off-chain hint)
    //   4. This function calls emit_falcon_sig_to_stack(msg, pk_hash) to request σ from the host
    //   5. rpo_falcon512_verify(pk_hash, msg) verifies the signature inside the ZK proof
    //   6. If verification fails the entire transaction is rejected — no state change occurs
    //
    // The signature is never passed as a function parameter; it lives exclusively
    // in the advice provider and is consumed inside the ZK proof, giving
    // front-running protection (mempool only sees market_id + winning_outcome).
    pub fn settle_market(
        &mut self,
        market_id: Felt,
        winning_outcome: Felt,
    ) {
        // 1. Build the message the Oracle must have signed
        let msg = make_settle_msg(market_id, winning_outcome);

        // 2. Load the committed Oracle public key hash from storage
        let pk_hash = self.oracle_pubkey_hash.get();

        // 3. Request the Falcon512 signature from the advice provider.
        //    The host (transaction executor) is responsible for providing σ.
        emit_falcon_sig_to_stack(msg, pk_hash);

        // 4. Verify the signature inside the ZK proof.
        //    Panics (and rolls back the tx) if verification fails.
        rpo_falcon512_verify(pk_hash, msg);

        // 5. Normal market-status checks
        let mut market = self.markets.get(market_id);
        assert!(
            market[IDX_STATUS].as_canonical_u64() == STATUS_OPEN,
            "market not open"
        );

        let now   = miden::tx::get_block_timestamp().as_canonical_u64();
        let close = market[IDX_CLOSE].as_canonical_u64();
        assert!(close <= now, "market not yet closed");

        let max_out   = market[IDX_OUTS].as_canonical_u64() as u32;
        let winning_u = winning_outcome.as_canonical_u64() as u32;
        assert!(winning_u < max_out, "invalid winning outcome");

        market[IDX_STATUS]  = Felt::new(STATUS_SETTLED);
        market[IDX_WIN_OUT] = winning_outcome;
        self.markets.set(market_id, market);
    }

    // ── Claim winnings ────────────────────────────────────────
    //
    // User reveals their bet data to reconstruct the commitment and claim.
    // Payout = amount × total_pool / winning_pool  (parimutuel)
    // Returns the payout amount.
    pub fn claim_winnings(
        &mut self,
        market_id: Felt,
        outcome: Felt,
        amount: Felt,
        user_secret: Felt,
    ) -> Felt {
        let market = self.markets.get(market_id);
        assert!(
            market[IDX_STATUS].as_canonical_u64() == STATUS_SETTLED,
            "market not settled"
        );

        let winning_u = market[IDX_WIN_OUT].as_canonical_u64() as u32;
        let outcome_u = outcome.as_canonical_u64() as u32;
        assert!(outcome_u == winning_u, "not a winning outcome");

        let commitment    = make_bet_commitment(market_id, outcome_u, amount, user_secret);
        let stored_amount = self.bets.get(commitment);
        assert!(stored_amount.as_canonical_u64() != 0, "bet not found");
        assert!(stored_amount == amount, "amount mismatch");
        assert!(self.claimed.get(commitment).as_canonical_u64() == 0, "already claimed");

        // Parimutuel: sum all outcome pools for this market
        let outcomes_count = market[IDX_OUTS].as_canonical_u64() as u32;
        let mut total: u128 = 0;
        for i in 0..outcomes_count {
            total += self.outcome_pools
                .get(pool_key(market_id, i))
                .as_canonical_u64() as u128;
        }
        let winning_pool = self.outcome_pools
            .get(pool_key(market_id, outcome_u))
            .as_canonical_u64() as u128;

        let payout: u64 = if winning_pool > 0 {
            (amount.as_canonical_u64() as u128 * total / winning_pool) as u64
        } else {
            0
        };

        // Mark as claimed with a non-zero sentinel so we never write Felt(0)
        self.claimed.set(commitment, Felt::new(STATUS_SETTLED));

        Felt::new(payout)
    }

    // ── View functions ────────────────────────────────────────

    // Returns Word[status, winning_outcome, close_time, outcomes_count]
    pub fn get_market(&self, market_id: Felt) -> Word {
        self.markets.get(market_id)
    }

    // Returns total amount bet on a specific outcome
    pub fn get_outcome_pool(&self, market_id: Felt, outcome: Felt) -> Felt {
        self.outcome_pools.get(pool_key(market_id, outcome.as_canonical_u64() as u32))
    }

    // Returns total number of markets created
    pub fn get_market_count(&self) -> Felt {
        self.market_count.get()
    }

    // Returns the stored Oracle Falcon512 public key hash
    pub fn get_oracle_pubkey_hash(&self) -> Word {
        self.oracle_pubkey_hash.get()
    }
}
