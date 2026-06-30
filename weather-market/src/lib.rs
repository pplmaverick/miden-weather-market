#![no_std]
#![feature(alloc_error_handler)]

use miden::{
    Felt, Word,
    StorageMap, StorageValue,
    component, component_storage,
    hash_words,
};

// ── Market status ─────────────────────────────────────────────
const STATUS_OPEN:    u64 = 1;
const STATUS_SETTLED: u64 = 2;

// ── Word slot indices for the `markets` StorageMap ────────────
const IDX_STATUS:  usize = 0;
const IDX_WIN_OUT: usize = 1;
const IDX_CLOSE:   usize = 2;
const IDX_OUTS:    usize = 3;

// ── Storage layout ────────────────────────────────────────────
#[component_storage]
struct WeatherMarketStorage {
    #[storage(description = "global market counter; also the next market_id")]
    market_count: StorageValue<Felt>,

    #[storage(description = "non-zero once initialize() has been called")]
    initialized: StorageValue<Felt>,

    #[storage(description = "Poseidon2 hash of the Oracle's Falcon512 public key")]
    oracle_pubkey_hash: StorageValue<Word>,

    #[storage(description = "market_id => [status, winning_outcome, close_time, outcomes_count]")]
    markets: StorageMap<Felt, Word>,

    #[storage(description = "pool_key(market_id, outcome) => cumulative bet amount")]
    outcome_pools: StorageMap<Felt, Felt>,

    #[storage(description = "bet_commitment => amount placed")]
    bets: StorageMap<Word, Felt>,

    #[storage(description = "bet_commitment => non-zero if winnings claimed")]
    claimed: StorageMap<Word, Felt>,
}

// ── Helpers ───────────────────────────────────────────────────

fn felt(v: u64) -> Felt {
    Felt::new(v).expect("value is a valid field element")
}

fn pool_key(market_id: Felt, outcome: u32) -> Felt {
    market_id * felt(256) + felt(outcome as u64)
}

fn make_bet_commitment(
    market_id: Felt,
    outcome: u32,
    amount: Felt,
    user_secret: Felt,
) -> Word {
    let data = Word::new([market_id, felt(outcome as u64), amount, user_secret]);
    Word::from(hash_words(&[data]))
}

// ── Contract trait ────────────────────────────────────────────
#[component]
trait WeatherMarketContract {
    fn initialize(&mut self, oracle_pubkey_hash: Word);
    fn create_market(&mut self, question_hash: Word, close_time: Felt, outcomes: Felt);
    fn place_bet(&mut self, market_id: Felt, outcome: Felt, amount: Felt, bet_commitment: Word);
    fn settle_market(&mut self, market_id: Felt, winning_outcome: Felt);
    fn claim_winnings(&mut self, market_id: Felt, outcome: Felt, amount: Felt, user_secret: Felt);
    fn get_market(&self, market_id: Felt) -> Word;
    fn get_outcome_pool(&self, market_id: Felt, outcome: Felt) -> Felt;
    fn get_market_count(&self) -> Felt;
    fn get_oracle_pubkey_hash(&self) -> Word;
}

// ── Contract methods ──────────────────────────────────────────
#[component]
impl WeatherMarketContract for WeatherMarketStorage {

    fn initialize(&mut self, oracle_pubkey_hash: Word) {
        assert!(
            self.initialized.get().as_canonical_u64() == 0,
            "already initialized"
        );
        self.oracle_pubkey_hash.set(oracle_pubkey_hash);
        self.initialized.set(felt(STATUS_OPEN));
    }

    fn create_market(
        &mut self,
        question_hash: Word,
        close_time: Felt,
        outcomes: Felt,
    ) {
        let _ = question_hash;
        assert!(outcomes.as_canonical_u64() >= 2, "need >= 2 outcomes");

        let id = self.market_count.get();
        self.markets.set(
            id,
            Word::new([
                felt(STATUS_OPEN),
                felt(STATUS_OPEN),
                close_time,
                outcomes,
            ]),
        );
        self.market_count.set(id + felt(1));
    }

    fn place_bet(
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

    fn settle_market(
        &mut self,
        market_id: Felt,
        winning_outcome: Felt,
    ) {
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

        market[IDX_STATUS]  = felt(STATUS_SETTLED);
        market[IDX_WIN_OUT] = winning_outcome;
        self.markets.set(market_id, market);
    }

    fn claim_winnings(
        &mut self,
        market_id: Felt,
        outcome: Felt,
        amount: Felt,
        user_secret: Felt,
    ) {
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

        let _payout: u64 = if winning_pool > 0 {
            (amount.as_canonical_u64() as u128 * total / winning_pool) as u64
        } else {
            0
        };

        self.claimed.set(commitment, felt(STATUS_SETTLED));
    }

    fn get_market(&self, market_id: Felt) -> Word {
        self.markets.get(market_id)
    }

    fn get_outcome_pool(&self, market_id: Felt, outcome: Felt) -> Felt {
        self.outcome_pools.get(pool_key(market_id, outcome.as_canonical_u64() as u32))
    }

    fn get_market_count(&self) -> Felt {
        self.market_count.get()
    }

    fn get_oracle_pubkey_hash(&self) -> Word {
        self.oracle_pubkey_hash.get()
    }
}
