# Miden Weather Prediction Market

在 [Miden](https://polygon.technology/miden) 上以 ZK 原生方式實作的天氣預測市場。下注過程完全私密（只有 ZK 承諾上鏈），結算與領獎公開可驗證。

## 專案結構

```
miden-weather-market/
├── counter-contract/   # 練習用 Counter Contract（確認編譯流程）
└── weather-market/     # 主合約：Weather Prediction Market
```

## 合約功能

| 函式 | 說明 |
|---|---|
| `initialize(oracle_secret_hash)` | 部署後一次性初始化，設定 oracle 公開承諾 |
| `create_market(question_hash, close_time, outcomes)` | 建立新預測市場，回傳 `market_id` |
| `place_bet(market_id, outcome, amount, bet_commitment)` | 下注，`bet_commitment` 由客戶端計算，user_secret 不上鏈 |
| `settle_market(market_id, winning_outcome, oracle_secret)` | Oracle 揭露秘密並公布獲勝結果（需 close_time 已過） |
| `claim_winnings(market_id, outcome, amount, user_secret)` | 揭露下注資料，領取 Parimutuel 分潤 |
| `get_market(market_id)` | 查詢市場狀態 |
| `get_outcome_pool(market_id, outcome)` | 查詢指定選項的累計注額 |
| `get_market_count()` | 查詢市場總數 |

## 技術架構

### ZK 私密下注
用戶在客戶端計算 `bet_commitment = hash([market_id, outcome, amount, user_secret])`，只把 commitment 和公開的 outcome / amount 提交上鏈。`user_secret` 永遠不離開用戶本地，領獎時才揭露。

### Oracle 驗證
部署者在 `initialize()` 時提交 `oracle_secret_hash = hash(oracle_secret_word)`。
`settle_market()` 時揭露原像 `oracle_secret_word`，合約驗證 hash 後才允許結算。

### Parimutuel 水池制
獲勝分潤 = `amount × total_pool / winning_pool`

所有選項的注額匯入同一水池，勝者按比例分潤，賠率根據即時注額動態變動。

### Anti-Double-Claim
每筆 `bet_commitment` 的領取狀態存在獨立的 `claimed` StorageMap，標記為非零 sentinel 值，防止重複領取，同時迴避 Miden WASM 的 `F32Const(0.0)` 限制。

## Testnet 部署資訊

| 項目 | 值 |
|---|---|
| **Contract ID** | `0xcfdec78bb6b0971016d7199e27e99a` |
| **Address** | `mtst1ar8aa3utk6cfwyqk6uveuflfngdmujgx` |
| **Deploy TX** | `0x036518df898d58c5a8300165c82e549d4edebbc153a4804a7052d3c539ecf6f8` |
| **Block** | 807844 |
| **Network** | Miden Testnet |

**Explorer：** https://midenscan.com/account/0xcfdec78bb6b0971016d7199e27e99a

## 開發環境

```toml
# rust-toolchain.toml
channel = "nightly-2025-12-10"
targets = ["wasm32-wasip2"]
components = ["rustfmt", "rust-src", "llvm-tools"]
```

```bash
# 安裝 cargo-miden
cargo +nightly-2025-12-10 install cargo-miden --locked --version 0.8.1

# 編譯
cargo miden build --release
# 輸出：target/miden/release/weather_market.masp
```

## Storage 佈局

```
WeatherMarketContract
├── initialized        : StorageValue<Felt>          # 初始化旗標（非零 = 已初始化）
├── market_count       : StorageValue<Felt>          # 市場計數 / 下一個 market_id
├── oracle_commitment  : StorageValue<Word>          # Oracle secret 的 Poseidon hash
├── markets            : StorageMap<Felt, Word>      # market_id → [status, winning_outcome, close_time, outcomes_count]
├── outcome_pools      : StorageMap<Felt, Felt>      # pool_key(market_id, outcome) → 累計注額
├── bets               : StorageMap<Word, Felt>      # bet_commitment → amount
└── claimed            : StorageMap<Word, Felt>      # bet_commitment → 非零表示已領取
```
