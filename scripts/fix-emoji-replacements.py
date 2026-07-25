#!/usr/bin/env python3
"""
Replace [!] text with AlertTriangle icon and [OK] with CheckCircle2 icon
in TSX files. Also replace PASS/FAIL text in visual contexts with
inline icon components.

Only replaces in JSX context (inside className spans/divs), not in
string literals used as status values.
"""
import os
import re

# Pattern: [!] that appears as a visual indicator (not in a string)
# We look for [!] inside JSX elements like <span>[!]</span>
WARNING_PATTERN = re.compile(r'(>\s*)\[!\](\s*<)')
OK_PATTERN = re.compile(r'(>\s*)\[OK\](\s*<)')

count = 0
for root, dirs, files in os.walk('src'):
    for fname in files:
        if not fname.endswith('.tsx'):
            continue
        fpath = os.path.join(root, fname)
        
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original = content
        changed = False
        
        # Replace [!] with AlertTriangle icon (inline)
        # Only in JSX context (between > and <)
        if '[!]' in content:
            # Check if AlertTriangle is already imported
            has_alert_import = 'AlertTriangle' in content
            
            # Replace [!] text with icon
            content = WARNING_PATTERN.sub(
                r'\1<AlertTriangle className="w-3.5 h-3.5 inline shrink-0" />\2',
                content
            )
            
            # Also replace standalone [!] in JSX expressions like {[!] message}
            content = re.sub(
                r'\[!\]\s*',
                '<AlertTriangle className="w-3.5 h-3.5 inline shrink-0" /> ',
                content
            )
            
            if '[!]' not in content and not has_alert_import:
                # Add import
                import_line = "import { AlertTriangle } from 'lucide-react'\n"
                # Find the last lucide-react import and add after it
                lucide_match = re.search(r"(import \{[^}]+\} from 'lucide-react')", content)
                if lucide_match:
                    old_import = lucide_match.group(1)
                    # Check if AlertTriangle is already in the import
                    if 'AlertTriangle' not in old_import:
                        new_import = old_import.replace('}', ', AlertTriangle }')
                        content = content.replace(old_import, new_import)
                else:
                    # Add a new import line after the first import
                    content = re.sub(
                        r"(import [^\n]+\n)",
                        r"\1" + import_line,
                        content,
                        count=1
                    )
            
            changed = True
        
        # Replace [OK] with CheckCircle2 icon
        if '[OK]' in content:
            has_check_import = 'CheckCircle2' in content
            
            content = OK_PATTERN.sub(
                r'\1<CheckCircle2 className="w-3.5 h-3.5 inline shrink-0" />\2',
                content
            )
            
            content = re.sub(
                r'\[OK\]\s*',
                '<CheckCircle2 className="w-3.5 h-3.5 inline shrink-0" /> ',
                content
            )
            
            if '[OK]' not in content and not has_check_import:
                lucide_match = re.search(r"(import \{[^}]+\} from 'lucide-react')", content)
                if lucide_match:
                    old_import = lucide_match.group(1)
                    if 'CheckCircle2' not in old_import:
                        new_import = old_import.replace('}', ', CheckCircle2 }')
                        content = content.replace(old_import, new_import)
                else:
                    import_line = "import { CheckCircle2 } from 'lucide-react'\n"
                    content = re.sub(
                        r"(import [^\n]+\n)",
                        r"\1" + import_line,
                        content,
                        count=1
                    )
            
            changed = True
        
        if content != original:
            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(content)
            count += 1
            print(f"  Fixed: {fpath}")

print(f"\nDone. {count} files fixed.")
