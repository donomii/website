"""
Single-file LiveObjects runtime (Python).
State and runtime travel together in this file; snapshots overwrite the base file and write suffixed backups.
Commands:
  python3 liveobjects.py -c "snapshot;exit"
  python3 liveobjects.py -c "boot.objsearch('NativeDialog').go('Hello world')"
"""

import argparse
import re
import subprocess
import textwrap
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Optional

try:
  import objc
  from Cocoa import (
    NSApp,
    NSApplication,
    NSApplicationActivationPolicyRegular,
    NSBackingStoreBuffered,
    NSButton,
    NSColor,
    NSMakeRect,
    NSRunningApplication,
    NSScrollView,
    NSSplitView,
    NSSplitViewDividerStyleThin,
    NSTableColumn,
    NSTableView,
    NSTextField,
    NSTextView,
    NSView,
    NSViewHeightSizable,
    NSViewWidthSizable,
    NSWindow,
    NSWindowStyleMaskClosable,
    NSWindowStyleMaskMiniaturizable,
    NSWindowStyleMaskResizable,
    NSWindowStyleMaskTitled,
  )
except Exception:
  objc = None

FILEPATH = Path(__file__)
SNAPSHOT_MARKER = "# === LIVEOBJECTS SNAPSHOT ==="

FIELD = "FIELD"
METHOD = "METHOD"
PARENT = "PARENT"


def _escape_osascript(text: str) -> str:
  return text.replace('"', '\\"')


def _native_dialog(message: str) -> None:
  """Tiny macOS dialog helper; falls back to stdout elsewhere."""
  safe = _escape_osascript(str(message))
  script = f'display dialog "{safe}" buttons {{"OK"}} default button "OK"'
  try:
    result = subprocess.run(
      ["osascript", "-e", script],
      check=False,
      capture_output=True,
      text=True,
    )
    if result.returncode != 0:
      print(message)
  except FileNotFoundError:
    print(message)


def _osascript_run(script: str) -> str:
  try:
    result = subprocess.run(
      ["osascript", "-e", script],
      check=False,
      capture_output=True,
      text=True,
    )
    if result.returncode != 0:
      return ""
    return result.stdout.strip()
  except FileNotFoundError:
    return ""


def _choose_from_list_native(prompt: str, items: List[str]) -> Optional[str]:
  if not items:
    return None
  esc_items = ", ".join(f'"{_escape_osascript(item)}"' for item in items)
  esc_prompt = _escape_osascript(prompt)
  script = "\n".join(
    [
      f"set theList to {{{esc_items}}}",
      f'set theChoice to choose from list theList with prompt "{esc_prompt}"',
      'if theChoice is false then return ""',
      "return item 1 of theChoice",
    ]
  )
  out = _osascript_run(script)
  return out if out else None


def _prompt_text_native(prompt: str, default: str = "") -> Optional[str]:
  esc_prompt = _escape_osascript(prompt)
  esc_default = _escape_osascript(default)
  script = "\n".join(
    [
      f'display dialog "{esc_prompt}" default answer "{esc_default}"',
      "set theText to text returned of result",
      "return theText",
    ]
  )
  out = _osascript_run(script)
  return out if out != "" else None


# ============================================================================
# BOOTSTRAP FUNCTIONS - EXCEPTION TO "ALL CODE IN SLOTS" RULE
# ============================================================================
# The following functions exist outside the slot system because they are
# required for the slot system itself to work, or provide core infrastructure.
#
# 1. _compile_method() - Called by jadd_slot() on line 232 to compile method
#    source code. MUST exist before any slot can be created.
#
# 2. _eval_in_context() - Evaluates code with access to boot object and
#    GLOBAL_ENV. Used by dynamically evaluated code in Manager classes and
#    slot methods. Must be in GLOBAL_ENV for eval'd code to call it.
#
# 3. OS Helper Functions (_native_dialog, _choose_from_list_native, etc.) -
#    Platform-specific utilities for macOS that don't belong in the object
#    model. These are simple wrappers around osascript calls.
# ============================================================================


def _eval_in_context(boot: "BootObject", code: str) -> Any:
  env = dict(GLOBAL_ENV)
  env["boot"] = boot
  code = code.strip()
  try:
    compiled = compile(code, "<cmd>", "eval")
    return eval(compiled, env, {})
  except SyntaxError:
    compiled = compile(code, "<cmd>", "exec")
    exec(compiled, env, {})
    return None


def _compile_method(source: str) -> Callable:
  cleaned = textwrap.dedent(source.strip("\n"))
  try:
    return eval(cleaned, GLOBAL_ENV, {})
  except SyntaxError:
    namespace: Dict[str, Any] = {}
    exec(cleaned, GLOBAL_ENV, namespace)
    funcs = [val for val in namespace.values() if callable(val)]
    if not funcs:
      raise ValueError("No callable found in method source")
    return funcs[-1]


GLOBAL_ENV: Dict[str, Any] = {
  "subprocess": subprocess,
  "textwrap": textwrap,
  "_native_dialog": _native_dialog,
  "_eval_in_context": _eval_in_context,
  "_choose_from_list_native": _choose_from_list_native,
  "_prompt_text_native": _prompt_text_native,
  "objc": objc,
  "NSApplication": globals().get("NSApplication"),
  "NSApp": globals().get("NSApp"),
  "NSRunningApplication": globals().get("NSRunningApplication"),
  "NSWindow": globals().get("NSWindow"),
  "NSScrollView": globals().get("NSScrollView"),
  "NSSplitView": globals().get("NSSplitView"),
  "NSTableView": globals().get("NSTableView"),
  "NSTableColumn": globals().get("NSTableColumn"),
  "NSTextView": globals().get("NSTextView"),
  "NSTextField": globals().get("NSTextField"),
  "NSColor": globals().get("NSColor"),
  "NSButton": globals().get("NSButton"),
  "NSView": globals().get("NSView"),
  "NSMakeRect": globals().get("NSMakeRect"),
  "NSBackingStoreBuffered": globals().get("NSBackingStoreBuffered"),
  "NSWindowStyleMaskTitled": globals().get("NSWindowStyleMaskTitled"),
  "NSWindowStyleMaskClosable": globals().get("NSWindowStyleMaskClosable"),
  "NSWindowStyleMaskResizable": globals().get("NSWindowStyleMaskResizable"),
  "NSWindowStyleMaskMiniaturizable": globals().get("NSWindowStyleMaskMiniaturizable"),
  "NSViewWidthSizable": globals().get("NSViewWidthSizable"),
  "NSViewHeightSizable": globals().get("NSViewHeightSizable"),
  "NSSplitViewDividerStyleThin": globals().get("NSSplitViewDividerStyleThin"),
  "NSApplicationActivationPolicyRegular": globals().get("NSApplicationActivationPolicyRegular"),
}


@dataclass
class Slot:
  name: str
  kind: str
  source: str
  value: Any = None


class ProtoObject:
  def __init__(self, name: str, boot: "BootObject"):
    self.name = name
    self.boot = boot
    self.slots: Dict[str, Slot] = {}
    self.serial: int = -1

  def __repr__(self) -> str:
    return f"<ProtoObject {self.name}#{self.serial}>"

  def __getattr__(self, key: str) -> Any:
    slots = self.__dict__.get("slots", {})
    if key in slots:
      slot = slots[key]
      if slot.kind == METHOD:
        return slot.value.__get__(self, self.__class__)
      return slot.value
    raise AttributeError(key)

  def jadd_slot(self, name: str, kind: str, source: str, value: Any = None) -> None:
    if name.startswith("widget_"):
      value = None
    if kind == METHOD:
      compiled = _compile_method(source)
      self.slots[name] = Slot(name, METHOD, source, compiled)
    elif kind == PARENT:
      self.slots[name] = Slot(name, PARENT, source, value)
    else:
      self.slots[name] = Slot(name, FIELD, source, value)

  def jaddSlots(self, mapping: Dict[str, Any]) -> None:
    for name, spec in mapping.items():
      if isinstance(spec, (list, tuple)) and len(spec) == 3:
        kind, source, value = spec
      else:
        raise ValueError("slot mapping entries must be (kind, source, value)")
      self.jadd_slot(name, kind, source, value)

  def delete_slot(self, name: str) -> None:
    if name in self.slots:
      del self.slots[name]

  def slot_names(self, kind: str) -> List[str]:
    return sorted([n for n, slot in self.slots.items() if slot.kind == kind])


class BootObject(ProtoObject):
  def __init__(self):
    super().__init__("BootObject", self)
    if "boot" in self.__dict__:
      del self.__dict__["boot"]
    self.serial = 0
    self.objects: Dict[str, ProtoObject] = {}
    self.oblist: List[ProtoObject] = []
    self.age: int = 0
    self.bootObj = self
    self._reset_registry()
    self._ensure_boot_slots()

  def _reset_registry(self) -> None:
    self.objects = {}
    self.oblist = []
    self.slots = {}
    self.register(self)

  def _ensure_boot_slots(self) -> None:
    if "i_am_a" not in self.slots:
      self.jadd_slot("i_am_a", FIELD, repr("BootObject"), "BootObject")
    if "objects" not in self.slots:
      self.jadd_slot("objects", FIELD, "{}", self.objects)
    if "oblist" not in self.slots:
      self.jadd_slot("oblist", FIELD, "[]", self.oblist)
    if "initialiser" not in self.slots:
      self.jadd_slot("initialiser", FIELD, "{}", {})
    if "age" not in self.slots:
      self.jadd_slot("age", FIELD, "0", self.age)
    if "Lobby" not in self.slots:
      self.jadd_slot("Lobby", FIELD, "None", None)
    if "jclone" not in self.slots:
      self.jadd_slot("jclone", FIELD, "None", None)
    if "delete_objects_by_name" not in self.slots:
      self.jadd_slot("delete_objects_by_name", FIELD, "{}", {})
    if "default_shutdown" not in self.slots:
      self.jadd_slot("default_shutdown", FIELD, "None", None)
    if "isApplication" not in self.slots:
      self.jadd_slot("isApplication", FIELD, repr("0"), "0")
    if "documentation" not in self.slots:
      doc = "BootObject manages registry and snapshots."
      self.jadd_slot("documentation", FIELD, repr(doc), doc)
    if "autoApplication" not in self.slots:
      self.jadd_slot("autoApplication", FIELD, "None", None)
    if "serial_number" not in self.slots:
      self.jadd_slot("serial_number", FIELD, repr(self.serial), self.serial)
    if "bootObj" not in self.slots:
      self.jadd_slot("bootObj", FIELD, "boot", self)
    if "tagline" not in self.slots:
      self.jadd_slot("tagline", METHOD, "lambda self: 'Boot object'", None)

  def register(self, obj: ProtoObject) -> None:
    self.objects[obj.name] = obj
    if obj not in self.oblist:
      self.oblist.append(obj)

  def objsearch(self, name: str) -> Optional[ProtoObject]:
    return self.objects.get(name)

  def sersearch(self, serial: int) -> Optional[ProtoObject]:
    for obj in self.oblist:
      if obj.serial == serial:
        return obj
    return None

  def prototypes(self) -> List[ProtoObject]:
    return [obj for obj in self.oblist if obj is not self]

  def fresh(self, name: str, tagline: Optional[str] = None) -> ProtoObject:
    obj = ProtoObject(name, self)
    obj.jadd_slot("i_am_a", FIELD, repr(name), name)
    obj.jadd_slot("serial_number", FIELD, repr(obj.serial), obj.serial)
    if tagline:
      obj.jadd_slot("tagline", METHOD, f"lambda self: {repr(tagline)}", None)
    self.register(obj)
    return obj

  def startup_all(self) -> None:
    for obj in list(self.oblist):
      fn = getattr(obj, "startup", None)
      if callable(fn):
        try:
          fn()
        except Exception as exc:
          print(f"startup failed on {obj.name}: {exc}")

  def boot(self) -> None:
    lobby = self.objsearch("Lobby")
    if lobby and hasattr(lobby, "go"):
      try:
        lobby.go()
      except Exception as exc:
        print(f"Lobby failed: {exc}")
    kb = self.objsearch("Keyboard_input_object")
    if kb and hasattr(kb, "get_input"):
      kb.get_input()
      return
    keyboard_loop(self)

  def run_command(self, command: str) -> Optional[str]:
    cmd = command.strip()
    if not cmd:
      return None
    if cmd == "exit":
      return "EXIT"
    if cmd == "snapshot":
      self.snapshot()
      return None
    executor = self.objects.get("Command_executor")
    if executor:
      result = executor.execute(cmd)
      return "EXIT" if result == "EXIT" else result
    return None

  def run_commands(self, commands: Iterable[str]) -> None:
    for cmd in commands:
      result = self.run_command(cmd)
      if result == "EXIT":
        break
      if result is not None:
        print(result)

  def _base_filename(self) -> str:
    match = re.match(r"^(?P<base>.+\\.py)(?:\\.\\d+)?$", FILEPATH.name)
    return match.group("base") if match else FILEPATH.name

  def _next_snapshot_number(self) -> int:
    base = self._base_filename()
    prefix = base + "."
    max_num = -1
    for path in FILEPATH.parent.iterdir():
      name = path.name
      if not name.startswith(prefix):
        continue
      suffix = name[len(prefix):]
      if suffix.isdigit():
        max_num = max(max_num, int(suffix))
    return max_num + 1

  def _snapshot_path(self, age: int) -> Path:
    base = self._base_filename()
    return FILEPATH.with_name(f"{base}.{age}")

  def _runtime_text(self) -> str:
    return FILEPATH.read_text()

  def _runtime_prefix(self) -> str:
    text = self._runtime_text()
    marker_line = "\n" + SNAPSHOT_MARKER
    if marker_line in text:
      return text.split(marker_line, 1)[0].rstrip() + "\n\n"
    if SNAPSHOT_MARKER in text:
      return text.split(SNAPSHOT_MARKER, 1)[0].rstrip() + "\n\n"
    return text.rstrip() + "\n\n"

  def _literal_for_field(self, name: str, value: Any) -> str:
    if name == "objects":
      return "{}"
    if name == "oblist":
      return "[]"
    if name.startswith("widget_"):
      return "None"
    return repr(value)

  def _slot_source(self, slot: Slot) -> str:
    if slot.source is None:
      return repr(slot.value)
    return slot.source

  def _render_snapshot_section(
    self,
    age: int,
    parent_links: List[tuple],
    field_links: List[tuple],
  ) -> str:
    lines: List[str] = []
    lines.append(SNAPSHOT_MARKER)
    lines.append(f"def hydrate(boot: BootObject) -> None:")
    lines.append(f"  boot.age = {age}")
    lines.append("  boot._reset_registry()")
    lines.append("  boot._ensure_boot_slots()")
    lines.append("  obj_by_serial: Dict[int, ProtoObject] = {}")
    lines.append("  GLOBAL_ENV['boot'] = boot")
    for obj in self.oblist:
      var_name = f"o{obj.serial}"
      if obj is self:
        lines.append(f"  {var_name} = boot")
      else:
        lines.append(f"  {var_name} = boot.fresh({repr(obj.name)})")
      lines.append(f"  {var_name}.serial = {obj.serial}")
      lines.append(f"  obj_by_serial[{obj.serial}] = {var_name}")
      lines.append("  #Fields:")
      for slot_name in obj.slot_names(FIELD):
        slot = obj.slots[slot_name]
        literal = self._literal_for_field(slot_name, slot.value)
        source = self._slot_source(slot)
        lines.append(
          f"  {var_name}.jadd_slot({repr(slot_name)}, FIELD, {repr(source)}, {literal})"
        )
      lines.append("  #Parents:")
      for slot_name in obj.slot_names(PARENT):
        slot = obj.slots[slot_name]
        source = self._slot_source(slot)
        lines.append(
          f"  {var_name}.jadd_slot({repr(slot_name)}, PARENT, {repr(source)}, None)"
        )
      lines.append("  #Methods:")
      for slot_name in obj.slot_names(METHOD):
        slot = obj.slots[slot_name]
        lines.append(
          f"  {var_name}.jadd_slot({repr(slot_name)}, METHOD, {repr(slot.source)}, None)"
        )
      lines.append("")
    lines.append("  # Parent links")
    for child_serial, slot_name, parent_serial in parent_links:
      lines.append(
        f"  object_link(obj_by_serial, {child_serial}, {repr(slot_name)}, {parent_serial})"
      )
    lines.append("  # Field links")
    for child_serial, slot_name, target_serial in field_links:
      lines.append(
        f"  field_link(obj_by_serial, {child_serial}, {repr(slot_name)}, {target_serial})"
      )
    lines.append("  boot.bootObj = boot")
    lines.append("")
    lines.append("HYDRATE = hydrate")
    lines.append("")
    lines.append("if __name__ == '__main__':")
    lines.append("  main()")
    lines.append("")
    return "\n".join(lines)

  def snapshot(self) -> Path:
    self._ensure_boot_slots()
    for idx, obj in enumerate(self.oblist):
      shutdown = getattr(obj, "shutdown", None)
      if callable(shutdown):
        try:
          shutdown()
        except Exception as exc:
          print(f"shutdown failed on {obj.name}: {exc}")
      obj.serial = idx
      if "serial_number" in obj.slots:
        obj.slots["serial_number"].value = obj.serial

    parent_links: List[tuple] = []
    parent_restore: List[tuple] = []
    field_links: List[tuple] = []
    field_restore: List[tuple] = []

    for obj in self.oblist:
      for slot_name, slot in obj.slots.items():
        if slot.kind == PARENT or slot_name.endswith("*"):
          target = slot.value
          parent_serial = target.serial if isinstance(target, ProtoObject) else target
          parent_links.append((obj.serial, slot_name, parent_serial))
          parent_restore.append((obj, slot_name, target))
          slot.value = None
        elif slot.kind == FIELD and isinstance(slot.value, ProtoObject):
          target = slot.value
          field_links.append((obj.serial, slot_name, target.serial))
          field_restore.append((obj, slot_name, target))
          slot.value = None

    age = self._next_snapshot_number()
    content = self._runtime_prefix() + self._render_snapshot_section(age, parent_links, field_links)

    backup_path = self._snapshot_path(age)
    backup_path.write_text(self._runtime_text())
    FILEPATH.write_text(content)

    self.age = age
    if "age" in self.slots:
      self.slots["age"].value = age

    for obj, slot_name, value in parent_restore:
      obj.slots[slot_name].value = value
    for obj, slot_name, value in field_restore:
      obj.slots[slot_name].value = value

    print(f"Snapshot saved to {FILEPATH} (age {age}); backup at {backup_path}")
    return FILEPATH


# Expose runtime classes to eval'ed methods.
GLOBAL_ENV["ProtoObject"] = ProtoObject
GLOBAL_ENV["BootObject"] = BootObject


def object_link(registry: Dict[int, ProtoObject], child_serial: int, slot_name: str, parent_serial: int) -> None:
  child = registry.get(child_serial)
  parent = registry.get(parent_serial)
  if not child or not parent:
    return
  if slot_name in child.slots:
    child.slots[slot_name].value = parent
  else:
    child.jadd_slot(slot_name, PARENT, repr(parent.name), parent)


def field_link(registry: Dict[int, ProtoObject], child_serial: int, slot_name: str, target_serial: int) -> None:
  child = registry.get(child_serial)
  target = registry.get(target_serial)
  if not child or not target:
    return
  if slot_name in child.slots:
    child.slots[slot_name].value = target
  else:
    child.jadd_slot(slot_name, FIELD, repr(target.name), target)


def keyboard_loop(boot: BootObject) -> None:
  while True:
    try:
      line = input("LiveObjects> ").strip()
    except EOFError:
      break
    if not line:
      continue
    result = boot.run_command(line)
    if result == "EXIT":
      break
    if result is not None:
      print(result)


def main() -> None:
  parser = argparse.ArgumentParser(description="Single-file LiveObjects runtime.")
  parser.add_argument("-c", "--command", help="Semicolon-separated commands to run", default="")
  args = parser.parse_args()

  boot = BootObject()
  GLOBAL_ENV["boot"] = boot
  HYDRATE(boot)
  boot.startup_all()

  if args.command:
    commands = [chunk for chunk in args.command.split(";") if chunk != ""]
    boot.run_commands(commands)
    return

  boot.boot()

# === LIVEOBJECTS SNAPSHOT ===
def hydrate(boot: BootObject) -> None:
  boot.age = 19
  boot._reset_registry()
  boot._ensure_boot_slots()
  obj_by_serial: Dict[int, ProtoObject] = {}
  GLOBAL_ENV['boot'] = boot
  o0 = boot
  o0.serial = 0
  obj_by_serial[0] = o0
  #Fields:
  o0.jadd_slot('Lobby', FIELD, 'None', None)
  o0.jadd_slot('age', FIELD, '0', 0)
  o0.jadd_slot('autoApplication', FIELD, 'None', None)
  o0.jadd_slot('bootObj', FIELD, 'boot', None)
  o0.jadd_slot('default_shutdown', FIELD, 'None', None)
  o0.jadd_slot('delete_objects_by_name', FIELD, '{}', {})
  o0.jadd_slot('documentation', FIELD, "'BootObject manages registry and snapshots.'", 'BootObject manages registry and snapshots.')
  o0.jadd_slot('i_am_a', FIELD, "'BootObject'", 'BootObject')
  o0.jadd_slot('initialiser', FIELD, '{}', {})
  o0.jadd_slot('isApplication', FIELD, "'0'", '0')
  o0.jadd_slot('jclone', FIELD, 'None', None)
  o0.jadd_slot('objects', FIELD, '{}', {})
  o0.jadd_slot('oblist', FIELD, '[]', [])
  o0.jadd_slot('serial_number', FIELD, '0', 0)
  #Parents:
  #Methods:
  o0.jadd_slot('tagline', METHOD, "lambda self: 'Boot object'", None)

  o1 = boot.fresh('UniversalTraits')
  o1.serial = 1
  obj_by_serial[1] = o1
  #Fields:
  o1.jadd_slot('i_am_a', FIELD, "'UniversalTraits'", 'UniversalTraits')
  o1.jadd_slot('serial_number', FIELD, '1', 1)
  o1.jadd_slot('tagline', FIELD, "'Shared methods bucket'", 'Shared methods bucket')
  #Parents:
  #Methods:
  o1.jadd_slot('find', METHOD, 'lambda self, name_or_serial: self.boot.objsearch(name_or_serial) or self.boot.sersearch(name_or_serial)', None)

  o2 = boot.fresh('OS')
  o2.serial = 2
  obj_by_serial[2] = o2
  #Fields:
  o2.jadd_slot('Lobby', FIELD, 'None', None)
  o2.jadd_slot('i_am_a', FIELD, "'OS'", 'OS')
  o2.jadd_slot('serial_number', FIELD, '2', 2)
  o2.jadd_slot('tagline', FIELD, "'OS helper'", 'OS helper')
  #Parents:
  #Methods:
  o2.jadd_slot('executable_name', METHOD, "lambda self: 'python'", None)
  o2.jadd_slot('hostname', METHOD, "lambda self: subprocess.check_output(['hostname']).decode().strip()", None)
  o2.jadd_slot('mswindows', METHOD, 'lambda self: False', None)
  o2.jadd_slot('pid', METHOD, "lambda self: subprocess.check_output(['bash', '-c', 'echo $$']).decode().strip()", None)
  o2.jadd_slot('program_name', METHOD, 'lambda self: FILEPATH.name', None)
  o2.jadd_slot('system_copy', METHOD, "lambda self: 'cp'", None)
  o2.jadd_slot('uid', METHOD, 'lambda self: 0', None)

  o3 = boot.fresh('Command_executor')
  o3.serial = 3
  obj_by_serial[3] = o3
  #Fields:
  o3.jadd_slot('Lobby', FIELD, 'None', None)
  o3.jadd_slot('i_am_a', FIELD, "'Command_executor'", 'Command_executor')
  o3.jadd_slot('serial_number', FIELD, '3', 3)
  #Parents:
  o3.jadd_slot('UniversalTraits*', PARENT, "'UniversalTraits'", None)
  o3.jadd_slot('bootStrap*', PARENT, "'BootObject'", None)
  #Methods:
  o3.jadd_slot('execute', METHOD, 'lambda self, code: _eval_in_context(self.boot, code)', None)
  o3.jadd_slot('tagline', METHOD, "lambda self: 'I execute code strings'", None)

  o4 = boot.fresh('Keyboard_input_object')
  o4.serial = 4
  obj_by_serial[4] = o4
  #Fields:
  o4.jadd_slot('Lobby', FIELD, 'None', None)
  o4.jadd_slot('i_am_a', FIELD, "'Keyboard_input_object'", 'Keyboard_input_object')
  o4.jadd_slot('serial_number', FIELD, '4', 4)
  #Parents:
  o4.jadd_slot('UniversalTraits*', PARENT, "'UniversalTraits'", None)
  o4.jadd_slot('bootStrap*', PARENT, "'BootObject'", None)
  #Methods:
  o4.jadd_slot('get_input', METHOD, 'def get_input(self):\n  current = self.boot.objsearch("Inspector")\n  while True:\n    try:\n      line = input("LiveObjects> ")\n    except EOFError:\n      break\n    if line is None:\n      continue\n    cmd = line.strip()\n    if not cmd:\n      continue\n    if cmd.startswith(".") and current:\n      cmd = f"{current.name}{cmd}"\n    result = self.boot.run_command(cmd)\n    if result == "EXIT":\n      break\n    if result is not None:\n      print(result)\n', None)
  o4.jadd_slot('get_input_old', METHOD, 'def get_input_old(self):\n  while True:\n    try:\n      line = input("LiveObjects> ")\n    except EOFError:\n      break\n    if not line:\n      continue\n    result = self.boot.run_command(line.strip())\n    if result == "EXIT":\n      break\n    if result is not None:\n      print(result)\n', None)
  o4.jadd_slot('tagline', METHOD, "lambda self: 'I get input and execute it'", None)

  o5 = boot.fresh('NativeDialog')
  o5.serial = 5
  obj_by_serial[5] = o5
  #Fields:
  o5.jadd_slot('i_am_a', FIELD, "'NativeDialog'", 'NativeDialog')
  o5.jadd_slot('serial_number', FIELD, '5', 5)
  #Parents:
  o5.jadd_slot('UniversalTraits*', PARENT, "'UniversalTraits'", None)
  o5.jadd_slot('bootStrap*', PARENT, "'BootObject'", None)
  #Methods:
  o5.jadd_slot('go', METHOD, "lambda self, text='Hello from LiveObjects': _native_dialog(str(text))", None)
  o5.jadd_slot('tagline', METHOD, "lambda self: 'Native dialog helper'", None)

  o6 = boot.fresh('Inspector')
  o6.serial = 6
  obj_by_serial[6] = o6
  #Fields:
  o6.jadd_slot('Lobby', FIELD, 'None', None)
  o6.jadd_slot('current_object', FIELD, 'None', None)
  o6.jadd_slot('i_am_a', FIELD, "'Inspector'", 'Inspector')
  o6.jadd_slot('serial_number', FIELD, '6', 6)
  o6.jadd_slot('term', FIELD, 'None', None)
  #Parents:
  o6.jadd_slot('UniversalTraits*', PARENT, "'UniversalTraits'", None)
  o6.jadd_slot('bootStrap*', PARENT, "'BootObject'", None)
  #Methods:
  o6.jadd_slot('co', METHOD, "lambda self, name: setattr(self, 'current_object', self.boot.objsearch(name)) or self.current_object", None)
  o6.jadd_slot('display_method', METHOD, 'def display_method(self, target_name, slot_name):\n  target = self.boot.objsearch(target_name)\n  if not target:\n    print("No target")\n    return\n  slot = target.slots.get(slot_name)\n  if not slot:\n    print("No slot")\n    return\n  print(slot.source)\n', None)
  o6.jadd_slot('display_object', METHOD, 'def display_object(self, target_name=None):\n  target = self.boot.objsearch(target_name) if target_name else self.current_object\n  if not target:\n    print("No target")\n    return\n  print(f"Object: {target.name}")\n  for slot in sorted(target.slots.values(), key=lambda s: s.name):\n    print(f"  {slot.kind:<6} {slot.name}")\n', None)
  o6.jadd_slot('list_objects', METHOD, 'def list_objects(self):\n  for obj in self.boot.oblist:\n    tag = getattr(obj, "tagline", lambda: "")()\n    print(f"{obj.serial}\\t{obj.name}\\t{tag}")\n', None)
  o6.jadd_slot('startup', METHOD, "lambda self: setattr(self, 'current_object', self.boot.objsearch('Inspector') or self)", None)
  o6.jadd_slot('tagline', METHOD, "lambda self: 'Lists registered objects'", None)

  o7 = boot.fresh('Lobby')
  o7.serial = 7
  obj_by_serial[7] = o7
  #Fields:
  o7.jadd_slot('i_am_a', FIELD, "'Lobby'", 'Lobby')
  o7.jadd_slot('serial_number', FIELD, '7', 7)
  #Parents:
  o7.jadd_slot('UniversalTraits*', PARENT, "'UniversalTraits'", None)
  o7.jadd_slot('bootStrap*', PARENT, "'BootObject'", None)
  #Methods:
  o7.jadd_slot('go', METHOD, 'def go(self):\n  if objc is None:\n    print("Cocoa bridge not available; install pyobjc-core and pyobjc-framework-Cocoa.")\n    return None\n  try:\n    app = NSApplication.sharedApplication()\n  except Exception as exc:\n    print(f"Cocoa init failed: {exc}")\n    return None\n  app_running = False\n  try:\n    app_running = bool(app.isRunning())\n  except Exception:\n    app_running = False\n\n  apps = [o for o in self.boot.prototypes() if getattr(o, "isApplication", None) == "yes"]\n\n  class AppDelegate(objc.lookUpClass("NSObject")):\n    def applicationShouldTerminateAfterLastWindowClosed_(self, app):\n      return True\n\n  class Manager(objc.lookUpClass("NSObject")):\n    def initWithBoot_apps_(self, boot_obj, app_list):\n      self = objc.super(Manager, self).init()\n      if self is None:\n        return None\n      self.boot = boot_obj\n      self.apps = app_list\n      self.table = None\n      self.selected = None\n      return self\n\n    def numberOfRowsInTableView_(self, tableView):\n      return len(self.apps)\n\n    def tableView_objectValueForTableColumn_row_(self, tableView, column, row):\n      obj = self.apps[row]\n      human = getattr(obj, "humanName", obj.name)\n      return human\n\n    def tableViewSelectionDidChange_(self, notification):\n      tv = notification.object()\n      idx = tv.selectedRow()\n      if 0 <= idx < len(self.apps):\n        self.selected = self.apps[idx]\n\n    def launch_(self, sender):\n      if not self.selected:\n        return\n      obj = self.selected\n      obj.go()\n\n    @objc.python_method\n    def build(self) -> NSWindow:\n      app_local = NSApp() or NSApplication.sharedApplication()\n      NSRunningApplication.currentApplication().activateWithOptions_(1 << 1)\n      style = (\n        NSWindowStyleMaskTitled\n        | NSWindowStyleMaskClosable\n        | NSWindowStyleMaskResizable\n        | NSWindowStyleMaskMiniaturizable\n      )\n      window = NSWindow.alloc().initWithContentRect_styleMask_backing_defer_(\n        NSMakeRect(0, 0, 400, 400), style, NSBackingStoreBuffered, False\n      )\n      window.setTitle_("LiveObjects Lobby")\n\n      table = NSTableView.alloc().initWithFrame_(NSMakeRect(0, 30, 400, 370))\n      col = NSTableColumn.alloc().initWithIdentifier_("apps")\n      col.setWidth_(380)\n      table.addTableColumn_(col)\n      table.setHeaderView_(None)\n      self.table = table\n      table.setDelegate_(self)\n      table.setDataSource_(self)\n\n      scroll = NSScrollView.alloc().initWithFrame_(NSMakeRect(0, 30, 400, 370))\n      scroll.setHasVerticalScroller_(True)\n      scroll.setDocumentView_(table)\n\n      launch_btn = NSButton.alloc().initWithFrame_(NSMakeRect(0, 0, 100, 30))\n      launch_btn.setTitle_("Launch")\n      launch_btn.setTarget_(self)\n      launch_btn.setAction_("launch:")\n\n      container = NSView.alloc().initWithFrame_(NSMakeRect(0, 0, 400, 400))\n      scroll.setAutoresizingMask_(NSViewWidthSizable | NSViewHeightSizable)\n      launch_btn.setAutoresizingMask_(NSViewWidthSizable)\n      container.addSubview_(scroll)\n      container.addSubview_(launch_btn)\n\n      window.setContentView_(container)\n      window.center()\n      window.makeKeyAndOrderFront_(None)\n\n      if self.apps:\n        table.selectRowIndexes_byExtendingSelection_(objc.lookUpClass("NSIndexSet").indexSetWithIndex_(0), False)\n        self.selected = self.apps[0]\n      return window\n\n  if not app_running:\n    app.setActivationPolicy_(NSApplicationActivationPolicyRegular)\n    delegate = AppDelegate.alloc().init()\n    app.setDelegate_(delegate)\n  mgr = Manager.alloc().initWithBoot_apps_(self.boot, apps)\n  mgr.build()\n  if not app_running:\n    app.run()\n  return None\n', None)
  o7.jadd_slot('tagline', METHOD, "lambda self: 'Entry point placeholder'", None)

  o8 = boot.fresh('PrimaBrowser')
  o8.serial = 8
  obj_by_serial[8] = o8
  #Fields:
  o8.jadd_slot('Lobby', FIELD, 'None', None)
  o8.jadd_slot('documentation', FIELD, "'Object editor stub'", 'Object editor stub')
  o8.jadd_slot('humanName', FIELD, "'Object Editor'", 'Object Editor')
  o8.jadd_slot('i_am_a', FIELD, "'PrimaBrowser'", 'PrimaBrowser')
  o8.jadd_slot('input_method_name', FIELD, "''", '')
  o8.jadd_slot('isApplication', FIELD, "'yes'", 'yes')
  o8.jadd_slot('selected_method', FIELD, 'None', None)
  o8.jadd_slot('selected_object', FIELD, 'None', None)
  o8.jadd_slot('serial_number', FIELD, '8', 8)
  o8.jadd_slot('tagline', FIELD, "'I edit object slots'", 'I edit object slots')
  o8.jadd_slot('widget_code', FIELD, 'None', None)
  o8.jadd_slot('widget_error_display', FIELD, 'None', None)
  o8.jadd_slot('widget_frameset', FIELD, 'None', None)
  o8.jadd_slot('widget_input_method', FIELD, 'None', None)
  o8.jadd_slot('widget_list_methods', FIELD, 'None', None)
  o8.jadd_slot('widget_list_object', FIELD, 'None', None)
  o8.jadd_slot('widget_window', FIELD, 'None', None)
  #Parents:
  o8.jadd_slot('UniversalTraits*', PARENT, "'UniversalTraits'", None)
  o8.jadd_slot('bootStrap*', PARENT, "'BootObject'", None)
  #Methods:
  o8.jadd_slot('callback_add_method', METHOD, 'def callback_add_method(self, slot_name="new_method", source="lambda self: None"):\n  if not self.selected_object:\n    return None\n  self.selected_object.jadd_slot(slot_name, METHOD, source, None)\n  self.selected_method = slot_name\n  return slot_name\n', None)
  o8.jadd_slot('callback_delete_method', METHOD, 'def callback_delete_method(self, slot_name):\n  if not self.selected_object:\n    return None\n  self.selected_object.delete_slot(slot_name)\n  return slot_name\n', None)
  o8.jadd_slot('callback_method_selected', METHOD, 'def callback_method_selected(self, slot_name):\n  if not self.selected_object:\n    return None\n  slot = self.selected_object.slots.get(slot_name)\n  self.selected_method = slot_name\n  if slot:\n    print(slot.source)\n  return slot\n', None)
  o8.jadd_slot('callback_object_selected', METHOD, 'def callback_object_selected(self, target_name):\n  return self.edit_object(target_name)\n', None)
  o8.jadd_slot('callback_update_method', METHOD, 'def callback_update_method(self, source):\n  if not self.selected_method:\n    return None\n  return self.update(self.selected_method, source)\n', None)
  o8.jadd_slot('check_eval', METHOD, 'def check_eval(self, source):\n  try:\n    return _eval_in_context(self.boot, source)\n  except Exception as exc:\n    print(exc)\n    return None\n', None)
  o8.jadd_slot('clear_methods', METHOD, 'def clear_methods(self):\n  self.selected_method = None\n', None)
  o8.jadd_slot('display', METHOD, 'def display(self):\n  if not self.selected_object:\n    print("No selected object")\n    return\n  print(f"Object: {self.selected_object.name}")\n  for slot in sorted(self.selected_object.slots.values(), key=lambda s: s.name):\n    print(f"  {slot.kind:<6} {slot.name}")\n', None)
  o8.jadd_slot('display_objs', METHOD, 'def display_objs(self):\n  for obj in self.boot.prototypes():\n    print(obj.name)\n', None)
  o8.jadd_slot('edit_object', METHOD, 'def edit_object(self, target_name):\n  obj = self.boot.objsearch(target_name)\n  self.selected_object = obj\n  if not obj:\n    print("No such object")\n    return None\n  return obj\n', None)
  o8.jadd_slot('go', METHOD, 'def go(self, target_name=None):\n  if target_name:\n    self.edit_object(target_name)\n  else:\n    names = [o.name for o in self.boot.prototypes()]\n    if names:\n      self.edit_object(names[0])\n  self.display()\n', None)
  o8.jadd_slot('gstartup', METHOD, 'def gstartup(self, target_name=None):\n  return self.go(target_name)\n', None)
  o8.jadd_slot('shutdown', METHOD, 'def shutdown(self):\n  self.selected_object = None\n  self.selected_method = None\n', None)
  o8.jadd_slot('update', METHOD, 'def update(self, slot_name, source):\n  if not self.selected_object or not slot_name or not source:\n    return None\n  self.selected_object.jadd_slot(slot_name, METHOD, source, None)\n  self.selected_method = slot_name\n  return slot_name\n', None)

  o9 = boot.fresh('PrimaObjectManager')
  o9.serial = 9
  obj_by_serial[9] = o9
  #Fields:
  o9.jadd_slot('Lobby', FIELD, 'None', None)
  o9.jadd_slot('humanName', FIELD, "'Object Manager'", 'Object Manager')
  o9.jadd_slot('i_am_a', FIELD, "'PrimaObjectManager'", 'PrimaObjectManager')
  o9.jadd_slot('isApplication', FIELD, "'yes'", 'yes')
  o9.jadd_slot('selected_object', FIELD, 'None', None)
  o9.jadd_slot('serial_number', FIELD, '9', 9)
  o9.jadd_slot('tagline', FIELD, "'I create, delete and clone objects'", 'I create, delete and clone objects')
  o9.jadd_slot('widget_error_display', FIELD, 'None', None)
  o9.jadd_slot('widget_frameset', FIELD, 'None', None)
  o9.jadd_slot('widget_input_method', FIELD, 'None', None)
  o9.jadd_slot('widget_input_object_name', FIELD, 'None', None)
  o9.jadd_slot('widget_list_methods', FIELD, 'None', None)
  o9.jadd_slot('widget_list_object', FIELD, 'None', None)
  o9.jadd_slot('widget_window', FIELD, 'None', None)
  #Parents:
  o9.jadd_slot('UniversalTraits*', PARENT, "'UniversalTraits'", None)
  o9.jadd_slot('bootStrap*', PARENT, "'BootObject'", None)
  #Methods:
  o9.jadd_slot('callback_clone_object', METHOD, 'def callback_clone_object(self, name):\n  source = self.boot.objsearch(name)\n  if not source:\n    return None\n  clone = self.boot.fresh(f"Clone of {name}")\n  for slot in source.slots.values():\n    if slot.kind == METHOD:\n      clone.jadd_slot(slot.name, METHOD, slot.source, None)\n    elif slot.kind == PARENT:\n      clone.jadd_slot(slot.name, PARENT, slot.source, slot.value)\n    else:\n      clone.jadd_slot(slot.name, FIELD, slot.source, slot.value)\n  return clone\n', None)
  o9.jadd_slot('callback_delete_object', METHOD, 'def callback_delete_object(self, name):\n  obj = self.boot.objsearch(name)\n  if not obj or obj is self.boot:\n    return None\n  self.boot.oblist = [o for o in self.boot.oblist if o is not obj]\n  self.boot.objects.pop(obj.name, None)\n  return name\n', None)
  o9.jadd_slot('callback_edit_object', METHOD, 'def callback_edit_object(self, name):\n  pb = self.boot.objsearch("PrimaBrowser")\n  if not pb:\n    return None\n  pb.edit_object(name)\n  pb.display()\n  return pb\n', None)
  o9.jadd_slot('callback_new_object', METHOD, 'def callback_new_object(self, name):\n  if not name:\n    return None\n  obj = self.boot.fresh(name)\n  return obj\n', None)
  o9.jadd_slot('callback_object_selected', METHOD, 'def callback_object_selected(self, name):\n  obj = self.boot.objsearch(name)\n  self.selected_object = obj\n  return obj\n', None)
  o9.jadd_slot('clear_objects', METHOD, 'def clear_objects(self):\n  self.selected_object = None\n', None)
  o9.jadd_slot('display_objs', METHOD, 'def display_objs(self):\n  for obj in self.boot.prototypes():\n    print(obj.name)\n', None)
  o9.jadd_slot('go', METHOD, 'def go(self):\n  self.display_objs()\n', None)
  o9.jadd_slot('gstartup', METHOD, 'def gstartup(self):\n  return self.go()\n', None)
  o9.jadd_slot('update', METHOD, 'def update(self, slot_name, source):\n  if not self.selected_object:\n    return None\n  self.selected_object.jadd_slot(slot_name, METHOD, source, None)\n  return slot_name\n', None)

  o10 = boot.fresh('NativeObjectEditor')
  o10.serial = 10
  obj_by_serial[10] = o10
  #Fields:
  o10.jadd_slot('humanName', FIELD, "'Native Object Editor'", 'Native Object Editor')
  o10.jadd_slot('i_am_a', FIELD, "'NativeObjectEditor'", 'NativeObjectEditor')
  o10.jadd_slot('isApplication', FIELD, "'yes'", 'yes')
  o10.jadd_slot('selected_object', FIELD, 'None', None)
  o10.jadd_slot('serial_number', FIELD, '10', 10)
  o10.jadd_slot('tagline', FIELD, "'Native Cocoa browser/editor'", 'Native Cocoa browser/editor')
  o10.jadd_slot('widget_window', FIELD, 'None', None)
  #Parents:
  o10.jadd_slot('UniversalTraits*', PARENT, "'UniversalTraits'", None)
  o10.jadd_slot('bootStrap*', PARENT, "'BootObject'", None)
  #Methods:
  o10.jadd_slot('go', METHOD, 'def go(self):\n  if objc is None:\n    return None\n  \n  class Mgr(objc.lookUpClass("NSObject")):\n    def initWithBoot_(self, boot_obj):\n      self = objc.super(Mgr, self).init()\n      if self is None:\n        return None\n      self.boot = boot_obj\n      self.objects = [o for o in boot_obj.prototypes()]\n      self.slots = []\n      self.selected_obj = None\n      self.selected_slot = None\n      self.obj_table = None\n      self.slot_table = None\n      self.text_view = None\n      return self\n    \n    def numberOfRowsInTableView_(self, tv):\n      if tv == self.obj_table:\n        return len(self.objects)\n      return len(self.slots)\n    \n    def tableView_objectValueForTableColumn_row_(self, tv, col, row):\n      if tv == self.obj_table:\n        return self.objects[row].name\n      slot = self.slots[row]\n      prefix = "M" if slot.kind == "METHOD" else "F" if slot.kind == "FIELD" else "P"\n      return f"{prefix} {slot.name}"\n    \n    def tableViewSelectionDidChange_(self, notif):\n      tv = notif.object()\n      if tv == self.obj_table:\n        idx = tv.selectedRow()\n        if 0 <= idx < len(self.objects):\n          self._sel_obj(idx)\n      elif tv == self.slot_table:\n        idx = tv.selectedRow()\n        if 0 <= idx < len(self.slots):\n          self._sel_slot(idx)\n    \n    @objc.python_method\n    def _sel_obj(self, idx):\n      self.selected_obj = self.objects[idx]\n      self.slots = sorted(self.selected_obj.slots.values(), key=lambda s: s.name)\n      self.slot_table.reloadData()\n      if self.slots:\n        self.slot_table.selectRowIndexes_byExtendingSelection_(objc.lookUpClass("NSIndexSet").indexSetWithIndex_(0), False)\n        self._sel_slot(0)\n      else:\n        self.selected_slot = None\n        self.text_view.setString_("")\n    \n    @objc.python_method\n    def _sel_slot(self, idx):\n      self.selected_slot = self.slots[idx]\n      slot = self.selected_slot\n      if slot.kind == "METHOD":\n        text = slot.source\n      else:\n        text = slot.source if slot.source else repr(slot.value)\n      self.text_view.setString_(text)\n    \n    def save_(self, sender):\n      if not (self.selected_obj and self.selected_slot):\n        return\n      text = str(self.text_view.string())\n      slot = self.selected_slot\n      if slot.kind == "METHOD":\n        self.selected_obj.jadd_slot(slot.name, "METHOD", text, None)\n      else:\n        try:\n          val = _eval_in_context(self.boot, text)\n        except:\n          val = text\n        self.selected_obj.jadd_slot(slot.name, "FIELD", text, val)\n      self._sel_obj(self.objects.index(self.selected_obj))\n\n  mgr = Mgr.alloc().initWithBoot_(self.boot)\n  \n  w = NSWindow.alloc().initWithContentRect_styleMask_backing_defer_(NSMakeRect(0,0,900,500), NSWindowStyleMaskTitled|NSWindowStyleMaskClosable|NSWindowStyleMaskResizable|NSWindowStyleMaskMiniaturizable, NSBackingStoreBuffered, False)\n  w.setTitle_("LiveObjects Browser")\n  w.setReleasedWhenClosed_(False)\n  \n  split = NSSplitView.alloc().initWithFrame_(w.contentView().frame())\n  split.setDividerStyle_(NSSplitViewDividerStyleThin)\n  split.setVertical_(True)\n  split.setAutoresizingMask_(NSViewWidthSizable | NSViewHeightSizable)\n  w.contentView().addSubview_(split)\n  \n  def mk_tbl(width):\n    t = NSTableView.alloc().initWithFrame_(NSMakeRect(0,0,width,400))\n    c = NSTableColumn.alloc().initWithIdentifier_("col")\n    c.setWidth_(width)\n    t.addTableColumn_(c)\n    t.setHeaderView_(None)\n    return t\n  \n  obj_t = mk_tbl(200)\n  obj_s = NSScrollView.alloc().initWithFrame_(NSMakeRect(0,0,200,500))\n  obj_s.setHasVerticalScroller_(True)\n  obj_s.setDocumentView_(obj_t)\n  mgr.obj_table = obj_t\n  obj_t.setDelegate_(mgr)\n  obj_t.setDataSource_(mgr)\n  \n  slot_t = mk_tbl(250)\n  slot_s = NSScrollView.alloc().initWithFrame_(NSMakeRect(0,0,250,500))\n  slot_s.setHasVerticalScroller_(True)\n  slot_s.setDocumentView_(slot_t)\n  mgr.slot_table = slot_t\n  slot_t.setDelegate_(mgr)\n  slot_t.setDataSource_(mgr)\n  \n  txt = NSTextView.alloc().initWithFrame_(NSMakeRect(0,0,450,450))\n  txt.setAutoresizingMask_(NSViewWidthSizable | NSViewHeightSizable)\n  mgr.text_view = txt\n  txt_s = NSScrollView.alloc().initWithFrame_(NSMakeRect(0,30,450,470))\n  txt_s.setHasVerticalScroller_(True)\n  txt_s.setDocumentView_(txt)\n  \n  btn = NSButton.alloc().initWithFrame_(NSMakeRect(0,0,80,30))\n  btn.setTitle_("Save")\n  btn.setTarget_(mgr)\n  btn.setAction_("save:")\n  \n  right = NSView.alloc().initWithFrame_(NSMakeRect(0,0,450,500))\n  txt_s.setAutoresizingMask_(NSViewWidthSizable | NSViewHeightSizable)\n  btn.setAutoresizingMask_(NSViewWidthSizable)\n  right.addSubview_(txt_s)\n  right.addSubview_(btn)\n  \n  split.addArrangedSubview_(obj_s)\n  split.addArrangedSubview_(slot_s)\n  split.addArrangedSubview_(right)\n  \n  w.center()\n  w.makeKeyAndOrderFront_(None)\n  if mgr.objects:\n    obj_t.selectRowIndexes_byExtendingSelection_(objc.lookUpClass("NSIndexSet").indexSetWithIndex_(0), False)\n    mgr._sel_obj(0)\n  \n  if not hasattr(self.boot, "_windows"): self.boot._windows = []\n  self.boot._windows.append(w)\n  if not hasattr(self.boot, "_managers"): self.boot._managers = []\n  self.boot._managers.append(mgr)\n  return w\n', None)

  o11 = boot.fresh('NativeEvaluator')
  o11.serial = 11
  obj_by_serial[11] = o11
  #Fields:
  o11.jadd_slot('humanName', FIELD, "'Native Evaluator'", 'Native Evaluator')
  o11.jadd_slot('i_am_a', FIELD, "'NativeEvaluator'", 'NativeEvaluator')
  o11.jadd_slot('isApplication', FIELD, "'yes'", 'yes')
  o11.jadd_slot('serial_number', FIELD, '11', 11)
  o11.jadd_slot('tagline', FIELD, "'Native code evaluator'", 'Native code evaluator')
  o11.jadd_slot('widget_window', FIELD, 'None', None)
  #Parents:
  o11.jadd_slot('UniversalTraits*', PARENT, "'UniversalTraits'", None)
  o11.jadd_slot('bootStrap*', PARENT, "'BootObject'", None)
  #Methods:
  o11.jadd_slot('go', METHOD, 'def go(self):\n  if objc is None:\n    return None\n  w = NSWindow.alloc().initWithContentRect_styleMask_backing_defer_(NSMakeRect(200,200,600,400), NSWindowStyleMaskTitled|NSWindowStyleMaskClosable|NSWindowStyleMaskResizable, NSBackingStoreBuffered, False)\n  w.setTitle_("Evaluator")\n  w.setReleasedWhenClosed_(False)\n  w.makeKeyAndOrderFront_(None)\n  if not hasattr(self.boot, "_windows"): self.boot._windows = []\n  self.boot._windows.append(w)\n  return w\n', None)

  # Parent links
  object_link(obj_by_serial, 3, 'UniversalTraits*', 1)
  object_link(obj_by_serial, 3, 'bootStrap*', 0)
  object_link(obj_by_serial, 4, 'UniversalTraits*', 1)
  object_link(obj_by_serial, 4, 'bootStrap*', 0)
  object_link(obj_by_serial, 5, 'UniversalTraits*', 1)
  object_link(obj_by_serial, 5, 'bootStrap*', 0)
  object_link(obj_by_serial, 6, 'UniversalTraits*', 1)
  object_link(obj_by_serial, 6, 'bootStrap*', 0)
  object_link(obj_by_serial, 7, 'UniversalTraits*', 1)
  object_link(obj_by_serial, 7, 'bootStrap*', 0)
  object_link(obj_by_serial, 8, 'UniversalTraits*', 1)
  object_link(obj_by_serial, 8, 'bootStrap*', 0)
  object_link(obj_by_serial, 9, 'UniversalTraits*', 1)
  object_link(obj_by_serial, 9, 'bootStrap*', 0)
  object_link(obj_by_serial, 10, 'UniversalTraits*', 1)
  object_link(obj_by_serial, 10, 'bootStrap*', 0)
  object_link(obj_by_serial, 11, 'UniversalTraits*', 1)
  object_link(obj_by_serial, 11, 'bootStrap*', 0)
  # Field links
  field_link(obj_by_serial, 0, 'Lobby', 7)
  field_link(obj_by_serial, 0, 'bootObj', 0)
  boot.bootObj = boot

HYDRATE = hydrate

if __name__ == '__main__':
  main()
