#!/usr/bin/env python3
"""Fix broken multi-line imports caused by the logger insertion script."""

import os
import re

os.chdir('/home/z/my-project/repos/metardu')

# Pattern: line N is "import {" and line N+1 is "import { logger } from '@/lib/logger'"
# Fix: move logger import BEFORE the "import {" line

def fix_file(filepath):
    with open(filepath, 'r') as f:
        lines = f.readlines()

    changed = False
    i = 0
    while i < len(lines):
        if lines[i].strip() == 'import {' and i + 1 < len(lines):
            next_line = lines[i + 1].strip()
            if next_line == "import { logger } from '@/lib/logger'":
                # Swap: move logger import before the "import {" line
                logger_line = lines[i + 1]
                del lines[i + 1]
                lines.insert(i, logger_line)
                changed = True
        i += 1

    if changed:
        with open(filepath, 'w') as f:
            f.writelines(lines)
        print(f"  ✓ {filepath}")

# Find all .ts/.tsx files with the broken pattern
for root, dirs, files in os.walk('src'):
    dirs[:] = [d for d in dirs if d not in {'node_modules', '.next', '__tests__', '__mocks__'}]
    for fname in files:
        if fname.endswith(('.ts', '.tsx')):
            filepath = os.path.join(root, fname)
            try:
                with open(filepath) as f:
                    content = f.read()
                if "import {\nimport { logger } from '@/lib/logger'" in content:
                    fix_file(filepath)
            except:
                pass

print("Done.")
