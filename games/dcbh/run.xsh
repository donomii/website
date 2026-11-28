#!/usr/bin/env xsh
cd $XSH_SCRIPT_DIR
cd ../..
set game_url "http://127.0.0.1:63434/games/dcbh/"
if [eq [lindex [curl -fs -o /dev/null $game_url] 0] 0] {
  python3 -m webbrowser $game_url
} else {
  screen -dmS dcbh-preview python3 -m http.server 63434 --bind 127.0.0.1
  curl -fsS --retry 5 --retry-connrefused -o /dev/null $game_url
  if [eq [last-exit-code] 0] {
    python3 -m webbrowser $game_url
  } else {exit [last-exit-code]}
}
exit [last-exit-code]
