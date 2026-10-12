#!/usr/bin/env python3
"""Install canonical native source without editing the Xcode project/signing.

Run from any directory. The generated AppDelegate already belongs to Compile
Sources. A marked source block is appended there; the storyboard selects its
controller. --check validates only; --restore rolls back our last installation.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import time
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
MARKER = "// BEGIN PNET NATIVE TRANSPORT — managed by install-native.py"
END = "// END PNET NATIVE TRANSPORT"
TARGETS = ["ios/App/App/AppDelegate.swift", "ios/App/App/Base.lproj/Main.storyboard"]
TARGETS.append("ios/App/App/SceneDelegate.swift")
STATE = ROOT / "ios/pnet-native-install.json"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read(relative):
    path = ROOT / relative
    for part in [path, *path.parents]:
        if part == ROOT.parent:
            break
        if part.is_symlink():
            raise SystemExit("STOP: symlink in native project")
    return path.read_bytes()


def atomic(path, data):
    tmp = path.with_name(path.name + ".pnet-tmp")
    with tmp.open("xb") as f:
        f.write(data)
    os.replace(tmp, path)


def main():
    os.umask(0o077)
    mode = sys.argv[1:]
    if mode not in [[], ["--check"], ["--restore"]]:
        raise SystemExit("Use no arguments, --check, or --restore")
    original = {name: read(name) for name in TARGETS}
    state = json.loads(read("ios/pnet-native-install.json")) if STATE.exists() else None
    if state:
        for name in TARGETS:
            if digest(original[name]) != state["installed"][name]:
                raise SystemExit("STOP: native files changed after installation; preserve and inspect them first")
    if mode == ["--restore"]:
        if not state:
            raise SystemExit("STOP: no native installation to restore")
        restored = {}
        for name in TARGETS:
            relative = state["backup"] + "/" + Path(name).name
            if not relative.startswith("ios/pnet-native-backups/") or ".." in Path(relative).parts:
                raise SystemExit("STOP: invalid backup path")
            restored[name] = read(relative)
            if digest(restored[name]) != state["original"][name]:
                raise SystemExit("STOP: backup hash mismatch")
        for name, data in restored.items():
            atomic(ROOT / name, data)
        STATE.unlink()
        print("NATIVE_OVERLAY_RESTORED; backups retained")
        return

    app = original[TARGETS[0]].decode()
    if state:
        start = app.index("\n" + MARKER)
        if not app.endswith(END + "\n"):
            raise SystemExit("STOP: malformed native overlay")
        app = app[:start]
    elif MARKER in app or "PNETViewController" in app:
        raise SystemExit("STOP: unrecognized existing native implementation")
    if "import Capacitor" not in app or "class AppDelegate:" not in app:
        raise SystemExit("STOP: unexpected AppDelegate template")

    scene = original[TARGETS[2]].decode()
    expected_scene = "PNETViewController" if state else "CAPBridgeViewController"
    constructor = expected_scene + "()"
    assignment = "window?.rootViewController = " + constructor
    if scene.count(assignment) != 1 or len(re.findall(
        r"\b(?:CAPBridgeViewController|PNETViewController)\s*\(", scene
    )) != 1:
        raise SystemExit("STOP: unexpected SceneDelegate controller construction")
    scene = scene.replace(assignment, "window?.rootViewController = PNETViewController()", 1)
    pbx = read("ios/App/App.xcodeproj/project.pbxproj").decode()
    if "504EC3081FED79650016851F" not in pbx or "AppDelegate.swift in Sources" not in pbx:
        raise SystemExit("STOP: expected AppDelegate Compile Sources entry not found")

    storyboard = original[TARGETS[1]].decode()
    controllers = list(ET.fromstring(storyboard).iter("viewController"))
    if len(controllers) != 1 or controllers[0].get("id") != "BYZ-38-t0r":
        raise SystemExit("STOP: unexpected storyboard controller")
    expected = "PNETViewController" if state else "CAPBridgeViewController"
    if controllers[0].get("customClass") != expected:
        raise SystemExit("STOP: unexpected storyboard class")
    if not state:
        old = 'customClass="CAPBridgeViewController" customModule="Capacitor"'
        if storyboard.count(old) != 1:
            raise SystemExit("STOP: unexpected storyboard attributes")
        storyboard = storyboard.replace(old, 'customClass="PNETViewController" customModule="App" customModuleProvider="target"', 1)

    swift = read("native/PNETNative.swift").decode()
    output = {
        TARGETS[0]: (app + "\n" + MARKER + "\n" + swift.rstrip() + "\n" + END + "\n").encode(),
        TARGETS[1]: storyboard.encode(),
        TARGETS[2]: scene.encode(),
    }
    if mode == ["--check"]:
        print("NATIVE_INSTALL_GUARDS_OK")
        return
    if output == original:
        print("NATIVE_TRANSPORT_ALREADY_INSTALLED")
        return
    backup = ROOT / "ios/pnet-native-backups" / str(time.time_ns())
    backup.mkdir(parents=True, mode=0o700)
    for name, data in original.items():
        (backup / Path(name).name).write_bytes(data)
    # Preserve the pre-transport rollback target across later overlay updates.
    record = {
        "backup": state["backup"] if state else str(backup.relative_to(ROOT)),
        "original": state["original"] if state else {name: digest(data) for name, data in original.items()},
        "installed": {name: digest(data) for name, data in output.items()},
    }
    previous_state = STATE.read_bytes() if STATE.exists() else None
    try:
        for name, data in output.items():
            atomic(ROOT / name, data)
        atomic(STATE, (json.dumps(record, indent=2) + "\n").encode())
    except BaseException:
        for name, data in original.items():
            (ROOT / name).write_bytes(data)
        if previous_state is not None:
            STATE.write_bytes(previous_state)
        elif STATE.exists():
            STATE.unlink()
        raise
    print("NATIVE_TRANSPORT_INSTALLED")
    print("LOCAL_BACKUP:", backup)


if __name__ == "__main__":
    main()
