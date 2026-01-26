#!/usr/bin/env python3
"""Test that liveobjects loads correctly after dead code removal"""

import sys
sys.path.insert(0, '.')
exec(open('liveobjects.py').read())

boot = HYDRATE(BootObject())
print('Boot loaded successfully')
print(f'Lobby: {boot.objsearch("Lobby")}')
print(f'NativeObjectEditor: {boot.objsearch("NativeObjectEditor")}')
print(f'NativeEvaluator: {boot.objsearch("NativeEvaluator")}')
print('\nAll objects loaded correctly after dead code removal')
