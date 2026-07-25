#!/usr/bin/env python3
"""
Replace hardcoded near-black colors with CSS variables across map components.

Mapping:
  #0a0a0f  → var(--bg-primary)   (near-pure-black → warm charcoal #1A1816)
  #0d0d14  → var(--bg-secondary)  (near-pure-black → warm charcoal #221F1C)
  #14141e  → var(--bg-secondary)  (near-pure-black → warm charcoal #221F1C)

Also replace hardcoded orange:
  #D17B47  → var(--accent)        (already the same color, but use the variable)
"""

import os
import re
from pathlib import Path

# Files to process
FILES = [
    # Map components
    'src/app/map/MapClient.tsx',
    'src/app/map/MapErrorBoundary.tsx',
    'src/app/map/components/MapToolDock.tsx',
    'src/app/map/components/MapCoordSearch.tsx',
    'src/app/map/components/SnappingOptions.tsx',
    'src/app/map/components/OfflineDownloadButton.tsx',
    'src/app/map/components/MapStatusBar.tsx',
    'src/app/map/components/MapLoadingOverlay.tsx',
    'src/app/map/components/GpsTrackPanel.tsx',
    'src/app/map/components/BookmarkPanel.tsx',
    'src/app/map/components/SchemeLayerPanel.tsx',
    'src/app/map/components/MapInteractionToggle.tsx',
    'src/app/map/components/MapOverlays.tsx',
    'src/app/map/components/IdentifyPanel.tsx',
    'src/app/map/components/KeyboardShortcutsHelp.tsx',
    # Layout
    'src/components/NavBar.tsx',
    'src/components/layout/QuickCompute.tsx',
]

# Replacements (order matters — longer patterns first)
REPLACEMENTS = [
    # Black backgrounds
    ('bg-[#0a0a0f]', 'bg-[var(--bg-primary)]'),
    ('bg-[#0d0d14]', 'bg-[var(--bg-secondary)]'),
    ('bg-[#14141e]', 'bg-[var(--bg-secondary)]'),
    # Orange (accent) — only in className strings, not in JS string constants
    # We need to be careful: some #D17B47 are in OpenLayers style objects (not CSS classes)
    # Only replace the Tailwind className patterns
    ('bg-[#D17B47]', 'bg-[var(--accent)]'),
    ('text-[#D17B47]', 'text-[var(--accent)]'),
    ('border-[#D17B47]', 'border-[var(--accent)]'),
    ('hover:text-[#D17B47]', 'hover:text-[var(--accent)]'),
    ('hover:border-[#D17B47]', 'hover:border-[var(--accent)]'),
    ('hover:bg-[#D17B47]', 'hover:bg-[var(--accent)]'),
    ('focus:border-[#D17B47]', 'focus:border-[var(--accent)]'),
]

def process_file(filepath):
    """Process a single file, returning the number of replacements made."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        print(f"  SKIP (not found): {filepath}")
        return 0

    original = content
    total_replacements = 0

    for old, new in REPLACEMENTS:
        count = content.count(old)
        if count > 0:
            content = content.replace(old, new)
            total_replacements += count

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  ✓ {filepath}: {total_replacements} replacements")
    else:
        print(f"  - {filepath}: no changes needed")

    return total_replacements

def main():
    os.chdir('/home/z/my-project/repos/metardu')

    print("Replacing hardcoded black/orange with CSS variables...\n")

    total = 0
    for filepath in FILES:
        if os.path.exists(filepath):
            total += process_file(filepath)
        else:
            print(f"  SKIP (not found): {filepath}")

    print(f"\nTotal replacements: {total}")

if __name__ == '__main__':
    main()
