"""
Deprecated path.

The $BITE activity bot lives in the importable `bots` package.

  python -m bots --test
  python -m bots --daemon
  python -m bots --smoke

See docs/bite-bot.md and bots/.env.example.
"""

from __future__ import annotations

import sys
from pathlib import Path

_REPO = Path(__file__).resolve().parents[1]
if str(_REPO) not in sys.path:
    sys.path.insert(0, str(_REPO))

print(
    "docs/bite-bot.py is a shim — prefer: python -m bots …  (see docs/bite-bot.md)",
    file=sys.stderr,
)

from bots.bite_bot import main

raise SystemExit(main())
