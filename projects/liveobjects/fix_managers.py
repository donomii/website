#!/usr/bin/env python3
"""Fix manager storage in app go() methods"""

import sys
import re

# Read the file
with open('liveobjects.py', 'r') as f:
    content = f.read()

# Pattern to find where managers are stored
# Look for: self._manager = mgr
# Replace with: self._manager = mgr\n  _active_managers.append(mgr)

def fix_manager_storage(text):
    """Add manager to global list after storing in self._manager"""
    # Pattern: "self._manager = mgr" followed by newline and indent
    # We need to add the global list append right after
    pattern = r"(self\._manager = mgr)\n(  mgr\.build\(\))"
    replacement = r"\1\n  _active_managers.append(mgr)\n\2"
    return re.sub(pattern, replacement, text)

# Apply fix
new_content = fix_manager_storage(content)

if new_content != content:
    # Backup
    import shutil
    shutil.copy('liveobjects.py', 'liveobjects.py.backup_before_fix')

    # Write fixed version
    with open('liveobjects.py', 'w') as f:
        f.write(new_content)

    print("Fixed manager storage - added to _active_managers list")
    print("Backup saved to liveobjects.py.backup_before_fix")
else:
    print("No changes needed or pattern not found")
