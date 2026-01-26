#!/usr/bin/env python3
"""Apply the working multi-window pattern to liveobjects"""

import sys
sys.path.insert(0, '.')
exec(open('liveobjects.py').read())

# Get the boot object (created by liveobjects.py execution)
boot = HYDRATE(BootObject())

# Global list for windows
if not hasattr(boot, '_windows'):
    boot._windows = []

# Fix NativeObjectEditor - just create window, don't call app.run()
editor = boot.objsearch('NativeObjectEditor')
editor.jadd_slot('go', 'METHOD', '''def go(self):
  if objc is None:
    return None

  window = NSWindow.alloc().initWithContentRect_styleMask_backing_defer_(
    NSMakeRect(100, 100, 600, 400),
    NSWindowStyleMaskTitled | NSWindowStyleMaskClosable | NSWindowStyleMaskResizable,
    NSBackingStoreBuffered,
    False
  )
  window.setTitle_("Object Editor")
  window.setReleasedWhenClosed_(False)
  window.makeKeyAndOrderFront_(None)
  self.boot._windows.append(window)

  label = NSTextField.alloc().initWithFrame_(NSMakeRect(50, 180, 500, 30))
  label.setStringValue_("NativeObjectEditor Window")
  label.setEditable_(False)
  label.setBordered_(False)
  window.contentView().addSubview_(label)

  return window
''', None)

# Fix NativeEvaluator similarly
evaluator = boot.objsearch('NativeEvaluator')
evaluator.jadd_slot('go', 'METHOD', '''def go(self):
  if objc is None:
    return None

  window = NSWindow.alloc().initWithContentRect_styleMask_backing_defer_(
    NSMakeRect(200, 200, 600, 400),
    NSWindowStyleMaskTitled | NSWindowStyleMaskClosable | NSWindowStyleMaskResizable,
    NSBackingStoreBuffered,
    False
  )
  window.setTitle_("Evaluator")
  window.setReleasedWhenClosed_(False)
  window.makeKeyAndOrderFront_(None)
  self.boot._windows.append(window)

  label = NSTextField.alloc().initWithFrame_(NSMakeRect(50, 180, 500, 30))
  label.setStringValue_("NativeEvaluator Window")
  label.setEditable_(False)
  label.setBordered_(False)
  window.contentView().addSubview_(label)

  return window
''', None)

# Snapshot
boot.snapshot()
print("Applied fix and saved snapshot")
