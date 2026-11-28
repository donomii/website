#!/usr/bin/env xsh
cd $XSH_SCRIPT_DIR
node --test tests/levels.test.cjs
exit [last-exit-code]
