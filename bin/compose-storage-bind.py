#!/usr/bin/env python3
"""Read `docker compose config --format json` on stdin; print the app bind source.

Must stay compatible with Python 3.6.9 (prod VPS, Ubuntu 18.04).
No walrus, no `from __future__ import annotations`, no 3.7+ stdlib APIs.
"""

import json
import sys


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0
    services = data.get("services") or {}
    app = services.get("app") or {}
    volumes = app.get("volumes") or []
    for volume in volumes:
        if isinstance(volume, dict) and volume.get("target") == "/var/www/html/storage":
            source = volume.get("source", "") or ""
            if source:
                sys.stdout.write(source + "\n")
            break
    return 0


if __name__ == "__main__":
    sys.exit(main())
