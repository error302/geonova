#!/usr/bin/env python3
"""Merge gitleaks default ruleset with METARDU allowlist into .gitleaks.toml.

The default ruleset (208 rules) comes from gitleaks v8.24.3's config/gitleaks.toml.
A custom config with no [[rules]] sections scans with ZERO rules — a silent
no-op scanner. So we embed the defaults verbatim and append our allowlist.

IMPORTANT when upgrading gitleaks: re-fetch the matching default config for the
pinned version and re-run this merge (see docs/SECURITY_ROUTINE.md §5 quarterly
review) — otherwise the embedded ruleset silently ages.
"""
import re
import sys

DEFAULT = "/tmp/gitleaks-default.toml"
OUT = "/home/z/my-project/metardu/.gitleaks.toml"

with open(DEFAULT) as f:
    default = f.read()

# The upstream default config ends with its own [allowlist] (for example
# domains/tokens). We keep it — it only allows self-evident docs values —
# and append our project-specific allowlist below.

our_allowlist = r'''
# ─────────────────────────────────────────────────────────────────────────────
# METARDU project allowlist (appended by scripts/merge-gitleaks.py — do not
# hand-edit this section; edit the script and re-run it)
#
# Semantics: within ONE [allowlist], `paths` and `regexes` are independent
# suppression triggers (OR). We deliberately do NOT try to express
# "regex X only in path Y" (impossible in gitleaks):
#   - paths  = only files that are generated or intentionally fake (fixtures)
#   - regexes = only self-evidently-fake placeholder VALUES
# Anything that looks like a real credential is flagged everywhere, including
# docs/ — intentional: the C-01 regression was a docs file.
# ─────────────────────────────────────────────────────────────────────────────

[[allowlists]]
id = "metardu-generated-files"
description = "Generated/vendored files never contain first-party secrets"
paths = [
  '(^|/)pnpm-lock\.yaml$',
  '(^|/)package-lock\.json$',
  '(^|/)yarn\.lock$',
  '(^|/)uv\.lock$',
  '(^|/)poetry\.lock$',
  '(^|/)node_modules/',
  '(^|/)\.next/',
  '(^|/)public/workbox-[^/]+\.js$',
  '(^|/)public/sw\.js$',
]

[[allowlists]]
id = "metardu-test-fixtures"
description = "Test fixtures with deliberately fake keys/HMACs (payments contract tests, sanitizer tests). Quarterly review (SECURITY_ROUTINE.md §5) must confirm nothing real ever lands here."
paths = [
  '__tests__/[^/]*fixtures?/',
  '__tests__/[^/]*webhook[^/]*\.json$',
]

[[allowlists]]
id = "metardu-obvious-placeholders"
description = "Self-evidently-fake placeholder values — safe to honor in ANY file because they cannot be valid credentials"
regexes = [
  '(?i)^(your|my|replace[_-]?me|example|dummy|fake|test|placeholder|sample|xxx+)[-_a-z0-9]*$',
  '(?i)^(your|my|example|dummy|fake|placeholder)[-_a-z0-9]+(key|token|secret|password|passphrase|pwd|host)$',
  '<your[_-][a-z_]+>',
  '\\$\\{[A-Z][A-Z_0-9]+:\\?[^}]*\\}',
  '\\bDUMMY[A-Z0-9_]*\\b',
  '\\b(sk|pk|rk)_(test|dummy|example)_[A-Za-z0-9]{4,}\\b',
]
'''

merged = default.rstrip() + "\n" + our_allowlist
with open(OUT, "w") as f:
    f.write(merged)

rules = len(re.findall(r"^\[\[rules\]\]", merged, re.M))
print(f"written {OUT}: {rules} rules, 3 project allowlists")
