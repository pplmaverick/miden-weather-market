#!/usr/bin/env python3
"""
Miden Weather Market CLI
Usage: python3 miden_cli.py <subcommand> [options]

Subcommands:
  create-market   Create a new prediction market
  place-bet       Place a bet (auto-manages user_secret)
  settle-market   Settle a market (Oracle call)
  claim-winnings  Claim winnings (auto-reads user_secret)
"""

import argparse
import json
import os
import random
import subprocess
import sys

# ── Paths ─────────────────────────────────────────────────────────────────────
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

# ── user_secret management ────────────────────────────────────────────────────

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
    print(f"  user_secret saved to {BETS_FILE}  (market_id={market_id})")

def get_saved_secret(market_id: int) -> int | None:
    bets = load_bets()
    return bets.get(str(market_id))

# ── Binary checks ─────────────────────────────────────────────────────────────

def check_binary(path: str) -> bool:
    return os.path.isfile(path) and os.access(path, os.X_OK)

def require_binary(path: str, dry_run: bool = False):
    if dry_run:
        exists = check_binary(path)
        status = "✓" if exists else "✗ (not compiled)"
        print(f"  [binary] {path}  {status}")
        return
    if not check_binary(path):
        print(f"[error] binary not found or not executable: {path}")
        print(f"        run: cd {os.path.dirname(os.path.dirname(path))} && cargo build --release")
        sys.exit(1)

# ── subprocess helpers ────────────────────────────────────────────────────────

def run_tool(args: list[str], dry_run: bool = False) -> str | None:
    """Run an external tool. In dry_run mode, print the command and skip execution."""
    print(f"\n[Run] {' '.join(str(a) for a in args)}")
    if dry_run:
        print("  (--dry-run mode: skipping execution)")
        return None
    result = subprocess.run(args, capture_output=False, text=True)
    if result.returncode != 0:
        print(f"[error] tool exited with code {result.returncode}")
        sys.exit(result.returncode)
    return ""

def run_capture(args: list[str], dry_run: bool = False) -> str | None:
    """Run a tool and capture stdout. In dry_run mode, return a simulated value."""
    print(f"\n[Computing] {' '.join(str(a) for a in args)}")
    if dry_run:
        mock = "10812862698675043068,8483794432572135953,13865444810042079354,11830695914661148006"
        print(f"  (--dry-run simulated output): {mock}")
        return mock
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[error] commitment-helper failed: {result.stderr.strip()}")
        sys.exit(result.returncode)
    return result.stdout.strip()

# ── Subcommand: create-market ─────────────────────────────────────────────────

def cmd_create_market(args):
    require_binary(SUBMIT_CREATE, dry_run=args.dry_run)
    print("=== create_market ===")
    run_tool([SUBMIT_CREATE], dry_run=args.dry_run)

# ── Subcommand: place-bet ─────────────────────────────────────────────────────

def cmd_place_bet(args):
    require_binary(COMMITMENT_HELPER, dry_run=args.dry_run)
    require_binary(SUBMIT_PLACE_BET,  dry_run=args.dry_run)

    market_id = args.market_id
    outcome   = args.outcome
    amount    = args.amount

    if args.user_secret is not None:
        user_secret = args.user_secret
        print(f"  [Using provided user_secret = {user_secret}]")
    else:
        user_secret = random.randint(1, 2**32)
        print(f"  [Generated user_secret = {user_secret}]")

    print(f"\n=== place_bet ===")
    print(f"  market_id   = {market_id}")
    print(f"  outcome     = {outcome}")
    print(f"  amount      = {amount}")
    print(f"  user_secret = {user_secret}  ← needed for claim_winnings")

    # Step 1: compute bet_commitment (RPO256)
    commitment_str = run_capture(
        [COMMITMENT_HELPER, str(market_id), str(outcome), str(amount), str(user_secret)],
        dry_run=args.dry_run,
    )
    print(f"  bet_commitment (RPO256) = [{commitment_str}]")

    # Step 2: submit TX
    run_tool(
        [SUBMIT_PLACE_BET, str(market_id), str(outcome), str(amount), str(user_secret)],
        dry_run=args.dry_run,
    )

    # Step 3: persist user_secret
    if not args.dry_run:
        save_bet(market_id, user_secret)
    else:
        print(f"\n  (--dry-run mode: skipping save to {BETS_FILE})")

    print(f"\n✓ place_bet done! user_secret={user_secret} Save this securely.")

# ── Subcommand: settle-market ─────────────────────────────────────────────────

def cmd_settle_market(args):
    require_binary(SUBMIT_SETTLE, dry_run=args.dry_run)
    print("=== settle_market ===")
    run_tool([SUBMIT_SETTLE], dry_run=args.dry_run)

# ── Subcommand: claim-winnings ────────────────────────────────────────────────

def cmd_claim_winnings(args):
    require_binary(SUBMIT_CLAIM, dry_run=args.dry_run)

    market_id = args.market_id

    if args.user_secret is not None:
        user_secret = args.user_secret
        print(f"  [Using provided user_secret = {user_secret}]")
    else:
        user_secret = get_saved_secret(market_id)
        if user_secret is None:
            print(f"[error] no user_secret found for market_id={market_id}.")
            print(f"        use --user-secret to specify manually, or check {BETS_FILE}")
            sys.exit(1)
        print(f"  [Loaded user_secret = {user_secret} from {BETS_FILE}]")

    print(f"\n=== claim_winnings ===")
    print(f"  market_id   = {market_id}")
    print(f"  user_secret = {user_secret}")
    run_tool([SUBMIT_CLAIM], dry_run=args.dry_run)

# ── Subcommand: show-bets ─────────────────────────────────────────────────────

def cmd_show_bets(args):
    bets = load_bets()
    if not bets:
        print(f"No bets recorded ({BETS_FILE} does not exist or is empty)")
        return
    print(f"Saved bets ({BETS_FILE}):")
    print(f"{'market_id':<12} {'user_secret'}")
    print("-" * 30)
    for mid, secret in bets.items():
        print(f"{mid:<12} {secret}")

# ── argparse setup ────────────────────────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="miden_cli.py",
        description="Miden Weather Market Python CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    dry_run_flag = dict(
        action="store_true",
        default=False,
        help="Print commands that would run without submitting any TX",
    )

    subs = parser.add_subparsers(dest="command", required=True)

    # create-market
    p_create = subs.add_parser("create-market", help="Create a new prediction market")
    p_create.add_argument("--dry-run", **dry_run_flag)

    # place-bet
    p_bet = subs.add_parser("place-bet", help="Place a bet (auto-manages user_secret)")
    p_bet.add_argument("--market-id",   type=int, required=True, help="Market ID (starting from 0)")
    p_bet.add_argument("--outcome",     type=int, required=True, help="Predicted outcome (1=Yes, 2=No)")
    p_bet.add_argument("--amount",      type=int, required=True, help="Bet amount (token units)")
    p_bet.add_argument("--user-secret", type=int, default=None,  help="Specify user_secret manually (default: randomly generated)")
    p_bet.add_argument("--dry-run", **dry_run_flag)

    # settle-market
    p_settle = subs.add_parser("settle-market", help="Settle a market (Oracle call)")
    p_settle.add_argument("--dry-run", **dry_run_flag)

    # claim-winnings
    p_claim = subs.add_parser("claim-winnings", help="Claim winnings (auto-reads user_secret)")
    p_claim.add_argument("--market-id",   type=int, required=True, help="Market ID")
    p_claim.add_argument("--user-secret", type=int, default=None,  help="Specify user_secret manually (default: loaded from saved file)")
    p_claim.add_argument("--dry-run", **dry_run_flag)

    # show-bets
    subs.add_parser("show-bets", help="List all saved user_secret records")

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
