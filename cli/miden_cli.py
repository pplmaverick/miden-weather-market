#!/usr/bin/env python3
"""
Miden Weather Market CLI
用法: python3 miden_cli.py <subcommand> [options]

子指令:
  create-market   建立新預測市場
  place-bet       下注（自動管理 user_secret）
  settle-market   結算市場（Oracle 呼叫）
  claim-winnings  領取獎金（自動讀取 user_secret）
"""

import argparse
import json
import os
import random
import subprocess
import sys

# ── 路徑設定 ──────────────────────────────────────────────────────────────────
SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
TOOLS_DIR    = os.path.join(SCRIPT_DIR, "..", "tools")
BETS_FILE    = os.path.expanduser("~/.miden_bets.json")

def tool_path(name: str) -> str:
    return os.path.join(TOOLS_DIR, name, "target", "release", name)

COMMITMENT_HELPER  = tool_path("commitment-helper")
SUBMIT_PLACE_BET   = tool_path("submit-place-bet")
SUBMIT_CREATE      = tool_path("submit-create-market")
SUBMIT_SETTLE      = tool_path("submit-settle-market")
SUBMIT_CLAIM       = tool_path("submit-claim-winnings")

# ── user_secret 管理 ──────────────────────────────────────────────────────────

def load_bets() -> dict:
    if not os.path.exists(BETS_FILE):
        return {}
    with open(BETS_FILE, "r") as f:
        return json.load(f)

def save_bet(market_id: int, user_secret: int):
    bets = load_bets()
    bets[str(market_id)] = user_secret
    with open(BETS_FILE, "w") as f:
        json.dump(bets, f, indent=2)
    print(f"  user_secret 已存入 {BETS_FILE}  (market_id={market_id})")

def get_saved_secret(market_id: int) -> int | None:
    bets = load_bets()
    return bets.get(str(market_id))

# ── 工具檢查 ──────────────────────────────────────────────────────────────────

def check_binary(path: str) -> bool:
    return os.path.isfile(path) and os.access(path, os.X_OK)

def require_binary(path: str, dry_run: bool = False):
    if dry_run:
        exists = check_binary(path)
        status = "✓" if exists else "✗ (未編譯)"
        print(f"  [binary] {path}  {status}")
        return
    if not check_binary(path):
        print(f"[錯誤] binary 不存在或無執行權限: {path}")
        print(f"       請先執行: cd {os.path.dirname(os.path.dirname(path))} && cargo build --release")
        sys.exit(1)

# ── subprocess 呼叫 ───────────────────────────────────────────────────────────

def run_tool(args: list[str], dry_run: bool = False) -> str | None:
    """執行外部工具。dry_run=True 時只印指令不執行，回傳 None。"""
    print(f"\n[執行] {' '.join(str(a) for a in args)}")
    if dry_run:
        print("  (--dry-run 模式：略過實際執行)")
        return None
    result = subprocess.run(args, capture_output=False, text=True)
    if result.returncode != 0:
        print(f"[錯誤] 工具回傳 exit code {result.returncode}")
        sys.exit(result.returncode)
    return ""

def run_capture(args: list[str], dry_run: bool = False) -> str | None:
    """執行工具並捕捉 stdout。dry_run=True 時回傳模擬值。"""
    print(f"\n[計算] {' '.join(str(a) for a in args)}")
    if dry_run:
        # 回傳已知的 (0,1,1,42) 值供 dry-run 展示
        mock = "10812862698675043068,8483794432572135953,13865444810042079354,11830695914661148006"
        print(f"  (--dry-run 模擬輸出): {mock}")
        return mock
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[錯誤] commitment-helper 失敗: {result.stderr.strip()}")
        sys.exit(result.returncode)
    return result.stdout.strip()

# ── 子指令：create-market ─────────────────────────────────────────────────────

def cmd_create_market(args):
    require_binary(SUBMIT_CREATE, dry_run=args.dry_run)
    print("=== create_market ===")
    run_tool([SUBMIT_CREATE], dry_run=args.dry_run)

# ── 子指令：place-bet ─────────────────────────────────────────────────────────

def cmd_place_bet(args):
    require_binary(COMMITMENT_HELPER, dry_run=args.dry_run)
    require_binary(SUBMIT_PLACE_BET,  dry_run=args.dry_run)

    market_id = args.market_id
    outcome   = args.outcome
    amount    = args.amount

    # 生成 user_secret（或由使用者指定）
    if args.user_secret is not None:
        user_secret = args.user_secret
        print(f"  [使用指定的 user_secret = {user_secret}]")
    else:
        user_secret = random.randint(1, 2**32)
        print(f"  [隨機生成 user_secret = {user_secret}]")

    print(f"\n=== place_bet ===")
    print(f"  market_id   = {market_id}")
    print(f"  outcome     = {outcome}")
    print(f"  amount      = {amount}")
    print(f"  user_secret = {user_secret}  ← 領獎時需要")

    # 步驟 1：計算 bet_commitment（RPO256）
    commitment_str = run_capture(
        [COMMITMENT_HELPER, str(market_id), str(outcome), str(amount), str(user_secret)],
        dry_run=args.dry_run,
    )
    print(f"  bet_commitment (RPO256) = [{commitment_str}]")

    # 步驟 2：送出 TX
    run_tool(
        [SUBMIT_PLACE_BET, str(market_id), str(outcome), str(amount), str(user_secret)],
        dry_run=args.dry_run,
    )

    # 步驟 3：儲存 user_secret
    if not args.dry_run:
        save_bet(market_id, user_secret)
    else:
        print(f"\n  (--dry-run 模式：略過存檔 user_secret → {BETS_FILE})")

    print(f"\n✓ place_bet 完成！user_secret={user_secret} 請妥善保存。")

# ── 子指令：settle-market ─────────────────────────────────────────────────────

def cmd_settle_market(args):
    require_binary(SUBMIT_SETTLE, dry_run=args.dry_run)
    print("=== settle_market ===")
    run_tool([SUBMIT_SETTLE], dry_run=args.dry_run)

# ── 子指令：claim-winnings ────────────────────────────────────────────────────

def cmd_claim_winnings(args):
    require_binary(SUBMIT_CLAIM, dry_run=args.dry_run)

    market_id = args.market_id

    # 自動從存檔讀取 user_secret
    if args.user_secret is not None:
        user_secret = args.user_secret
        print(f"  [使用指定的 user_secret = {user_secret}]")
    else:
        user_secret = get_saved_secret(market_id)
        if user_secret is None:
            print(f"[錯誤] 找不到 market_id={market_id} 的 user_secret。")
            print(f"       請用 --user-secret 手動指定，或確認 {BETS_FILE} 內容。")
            sys.exit(1)
        print(f"  [從 {BETS_FILE} 讀取 user_secret = {user_secret}]")

    print(f"\n=== claim_winnings ===")
    print(f"  market_id   = {market_id}")
    print(f"  user_secret = {user_secret}")
    # 注意：submit-claim-winnings 目前仍是 hardcode，此處只做呼叫
    run_tool([SUBMIT_CLAIM], dry_run=args.dry_run)

# ── 子指令：show-bets ─────────────────────────────────────────────────────────

def cmd_show_bets(args):
    bets = load_bets()
    if not bets:
        print(f"目前沒有任何下注記錄（{BETS_FILE} 不存在或為空）")
        return
    print(f"已儲存的下注記錄（{BETS_FILE}）：")
    print(f"{'market_id':<12} {'user_secret'}")
    print("-" * 30)
    for mid, secret in bets.items():
        print(f"{mid:<12} {secret}")

# ── argparse 設定 ─────────────────────────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="miden_cli.py",
        description="Miden Weather Market Python CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    dry_run_flag = dict(
        action="store_true",
        default=False,
        help="只印出會執行的指令，不實際送 TX",
    )

    subs = parser.add_subparsers(dest="command", required=True)

    # create-market
    p_create = subs.add_parser("create-market", help="建立新預測市場")
    p_create.add_argument("--dry-run", **dry_run_flag)

    # place-bet
    p_bet = subs.add_parser("place-bet", help="下注（自動管理 user_secret）")
    p_bet.add_argument("--market-id",   type=int, required=True, help="市場 ID（從 0 開始）")
    p_bet.add_argument("--outcome",     type=int, required=True, help="預測結果（1=Yes, 2=No）")
    p_bet.add_argument("--amount",      type=int, required=True, help="下注金額（token 單位）")
    p_bet.add_argument("--user-secret", type=int, default=None,  help="手動指定 user_secret（預設隨機生成）")
    p_bet.add_argument("--dry-run", **dry_run_flag)

    # settle-market
    p_settle = subs.add_parser("settle-market", help="結算市場（Oracle 呼叫）")
    p_settle.add_argument("--dry-run", **dry_run_flag)

    # claim-winnings
    p_claim = subs.add_parser("claim-winnings", help="領取獎金（自動讀取 user_secret）")
    p_claim.add_argument("--market-id",   type=int, required=True, help="市場 ID")
    p_claim.add_argument("--user-secret", type=int, default=None,  help="手動指定 user_secret（預設從存檔讀取）")
    p_claim.add_argument("--dry-run", **dry_run_flag)

    # show-bets
    subs.add_parser("show-bets", help="列出已儲存的 user_secret 記錄")

    return parser

# ── main ──────────────────────────────────────────────────────────────────────

def main():
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "create-market":
        cmd_create_market(args)
    elif args.command == "place-bet":
        cmd_place_bet(args)
    elif args.command == "settle-market":
        cmd_settle_market(args)
    elif args.command == "claim-winnings":
        cmd_claim_winnings(args)
    elif args.command == "show-bets":
        cmd_show_bets(args)

if __name__ == "__main__":
    main()
