#!/bin/bash
# usage: shot.sh page.html out.png W H
cd "$(dirname "$0")"
google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
  --window-size=$3,$4 --virtual-time-budget=3000 --default-background-color=00000000 \
  --screenshot="$2" "file://$PWD/$1" 2>/dev/null
