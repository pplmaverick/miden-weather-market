#!/bin/bash
MIDEN_CLIENT="/Users/pplmaverick/Library/Application Support/midenup/toolchains/0.14.0/bin/miden-client"
CLOSE_TIME=1780157926
SCRIPT="/Users/pplmaverick/miden-weather-market/scripts/get_timestamp.masm"

get_ts() {
    "$MIDEN_CLIENT" sync > /dev/null 2>&1
    "$MIDEN_CLIENT" exec --script-path "$SCRIPT" 2>&1 | grep "^├──  3:" | awk '{print $3}'
}

echo "Waiting for block_ts >= $CLOSE_TIME (close_time of market_id=0)"
while true; do
    TS=$(get_ts)
    if [ -z "$TS" ]; then
        echo "Could not get timestamp, retrying..."
        sleep 30
        continue
    fi
    DIFF=$((CLOSE_TIME - TS))
    if [ "$DIFF" -le 0 ]; then
        echo "READY: block_ts=$TS >= close_time=$CLOSE_TIME, settling now!"
        break
    fi
    MIN=$((DIFF / 60))
    echo "block_ts=$TS, need ${DIFF}s more (~${MIN} min)"
    sleep 120
done
