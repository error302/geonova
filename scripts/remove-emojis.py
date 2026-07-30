#!/usr/bin/env python3
"""
Remove ALL emoji characters from .ts and .tsx files in src/.
Replaces them with text equivalents or removes them entirely.
"""
import os
import re

# Emoji ranges to match (same as the ripgrep pattern)
EMOJI_PATTERN = re.compile(
    "["
    "\U0001F300-\U0001F9FF"  # symbols & pictographs
    "\U00002600-\U000027BF"  # misc symbols + dingbats
    "\U0000FE00-\U0000FE0F"  # variation selectors
    "\U0001F600-\U0001F64F"  # emoticons
    "\U00002702-\U000027B0"  # dingbats
    "\U00002B00-\U00002BFF"  # misc symbols
    "\U0001F000-\U0001F02F"  # mahjong
    "\U0001F0A0-\U0001F0FF"  # playing cards
    "\U0001F100-\U0001F1FF"  # enclosed alnum
    "\U0001F200-\U0001F2FF"  # enclosed ideographic
    "\U0001FA00-\U0001FA6F"  # chess symbols
    "\U0001FA70-\U0001FAFF"  # symbols extended-A
    "]+",
    flags=re.UNICODE
)

# Specific replacements for common emojis used in code
REPLACEMENTS = {
    '\u2705': 'PASS',       # white heavy check mark
    '\u274c': 'FAIL',       # cross mark
    '\u26a0': '!',          # warning sign
    '\u26a0\ufe0f': '!',    # warning with variation selector
    '\u2702': '',           # black scissors
    '\u27b0': '',           # upper right curved arrow
    '\u2b1c': '',           # white large square
    '\u2b07': '',           # down arrow
    '\u2b06': '',           # up arrow
    '\u2b05': '',           # left arrow
    '\u27a1': '',           # right arrow
    '\u23f0': '',           # alarm clock
    '\u231b': '',           # hourglass
    '\u2691': '',           # flag
    '\u26cf': '',           # pick (mining)
    '\u26f5': '',           # sailboat (hydrographic)
    '\u2693': '',           # anchor
    '\u2708': '',           # airplane
    '\U0001f4cd': '',       # round pushpin
    '\U0001f4c8': '',       # chart increasing
    '\U0001f4ca': '',       # bar chart
    '\U0001f4cb': '',       # clipboard
    '\U0001f4cc': '',       # pushpin
    '\U0001f4ce': '',       # paperclip
    '\U0001f4d0': '',       # straight ruler
    '\U0001f4e2': '',       # loudspeaker
    '\U0001f4e7': '',       # e-mail
    '\U0001f4ed': '',       # mailbox with no mail
    '\U0001f527': '',       # wrench
    '\U0001f528': '',       # hammer
    '\U0001f52a': '',       # kitchen knife
    '\U0001f6a7': '',       # construction sign
    '\U0001f30d': '',       # globe showing europe-africa
    '\U0001f3af': '',       # direct hit (target)
    '\U0001f4f7': '',       # camera
    '\U0001f50d': '',       # left-pointing magnifying glass
    '\U0001f680': '',       # rocket
    '\U0001f4de': '',       # telephone receiver
    '\U0001f4f1': '',       # mobile phone
    '\U0001f4bb': '',       # laptop
    '\U0001f4fa': '',       # television
    '\U0001f3ed': '',       # factory
    '\U0001f3e2': '',       # office building
    '\U0001f3e6': '',       # bank
    '\U0001f3eb': '',       # school
    '\U0001f3a8': '',       # artist palette
    '\U0001f3b5': '',       # musical note
    '\U0001f3c6': '',       # trophy
    '\U0001f4a1': '',       # light bulb
    '\U0001f4a7': '',       # droplet
    '\U0001f4ab': '',       # dizzy
    '\U0001f525': '',       # fire
    '\U0001f6a2': '',       # ship
    '\U0001f682': '',       # locomotive
    '\U0001f695': '',       # taxi
    '\U0001f697': '',       # automobile
    '\U0001f699': '',       # sport utility vehicle
    '\U0001f6b2': '',       # bicycle
    '\U0001f6e3': '',       # motorway
    '\U0001f9ed': '',       # compass (surveying)
    '\U0001f9f0': '',       # toolbox
    '\U0001f9ee': '',       # abacus
    '\U0001faa0': '',       # roller skate
}

# Also handle check mark variants that are used as status indicators
CHECK_PATTERN = re.compile(r'[\u2705\u2714\u2713]')  # all check marks
CROSS_PATTERN = re.compile(r'[\u274c\u2716\u2718\u2715]')  # all X marks

count = 0
for root, dirs, files in os.walk('src'):
    for fname in files:
        if not (fname.endswith('.ts') or fname.endswith('.tsx')):
            continue
        fpath = os.path.join(root, fname)
        
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original = content
        
        # Apply specific replacements first
        for emoji, replacement in REPLACEMENTS.items():
            content = content.replace(emoji, replacement)
        
        # Replace remaining check marks with text
        content = CHECK_PATTERN.sub(lambda m: 'PASS' if m.group() == '\u2705' else '', content)
        
        # Replace remaining X marks with text
        content = CROSS_PATTERN.sub(lambda m: 'FAIL' if m.group() == '\u274c' else '', content)
        
        # Remove any remaining emoji characters
        content = EMOJI_PATTERN.sub('', content)
        
        if content != original:
            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(content)
            count += 1
            print(f"  Cleaned: {fpath}")

print(f"\nDone. {count} files cleaned.")
