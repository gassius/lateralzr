#!/usr/bin/env python3
"""Prove VPS-side Python runs on Python 3.6.

This file must itself be 3.6-compatible. CI runs it in python:3.6.15-buster
with REQUIRE_PYTHON36=1. Do not use walrus, postponed annotations,
capture_output=, text=, or other 3.7+ APIs.
"""

import glob
import json
import os
import py_compile
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PARSER = os.path.join(ROOT, "bin", "compose-storage-bind.py")
BIN_DIR = os.path.join(ROOT, "bin")


def fail(message):
    sys.stderr.write("FAIL %s\n" % message)
    sys.exit(1)


def run_parser(payload):
    proc = subprocess.Popen(
        [sys.executable, PARSER],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
    )
    if payload is None:
        out, err = proc.communicate("this is not json")
    else:
        out, err = proc.communicate(json.dumps(payload))
    return proc.returncode, out, err


def assert_eq(label, got, expected):
    if got != expected:
        fail("%s: expected %r, got %r" % (label, expected, got))
    print("OK %s" % label)


def main():
    print("sys.version=%s" % sys.version.replace("\n", " "))
    print("sys.version_info=%s" % (sys.version_info[:3],))
    if os.environ.get("REQUIRE_PYTHON36") == "1":
        if sys.version_info[0] != 3 or sys.version_info[1] != 6:
            fail("REQUIRE_PYTHON36=1 but interpreter is %s" % (sys.version_info[:3],))
        print("OK interpreter is Python 3.6")

    if not os.path.isfile(PARSER):
        fail("missing %s" % PARSER)
    py_compile.compile(PARSER, doraise=True)
    py_compile.compile(os.path.abspath(__file__), doraise=True)
    print("OK py_compile %s" % os.path.relpath(PARSER, ROOT))
    print("OK py_compile tests/scripts/test-vps-python36.py")

    code, out, err = run_parser(
        {
            "services": {
                "app": {
                    "volumes": [
                        {
                            "type": "bind",
                            "source": "/mnt/dummy-storage",
                            "target": "/var/www/html/storage",
                        }
                    ]
                }
            }
        }
    )
    assert_eq("bind source", (code, out.strip(), err), (0, "/mnt/dummy-storage", ""))

    code, out, err = run_parser({"services": {"app": {"volumes": []}}})
    assert_eq("empty volumes", (code, out, err), (0, "", ""))

    code, out, err = run_parser({})
    assert_eq("missing services", (code, out, err), (0, "", ""))

    code, out, err = run_parser(None)
    assert_eq("invalid json", (code, out, err), (0, "", ""))

    code, out, err = run_parser(
        {
            "services": {
                "app": {
                    "volumes": [
                        "/mnt/short:/var/www/html/storage",
                        {
                            "type": "bind",
                            "source": "/mnt/from-dict",
                            "target": "/var/www/html/storage",
                        },
                    ]
                }
            }
        }
    )
    assert_eq("skip short syntax", (code, out.strip(), err), (0, "/mnt/from-dict", ""))

    # VPS entrypoints must not hide extra python3 -c snippets from this check.
    for path in sorted(glob.glob(os.path.join(BIN_DIR, "*"))):
        name = os.path.basename(path)
        if name in ("lint-changed-yaml", "compose-storage-bind.py"):
            continue
        if not os.path.isfile(path):
            continue
        with open(path, "r") as handle:
            text = handle.read()
        if "python3 -c" in text or "python3 -c\"" in text:
            fail("%s embeds python3 -c; keep VPS Python in .py files" % name)
    print("OK no embedded python3 -c in VPS bin scripts")

    print("All VPS Python 3.6 checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
