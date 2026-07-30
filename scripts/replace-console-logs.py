#!/usr/bin/env python3
"""
Replace console.error / console.warn / console.log with structured logger calls.

Rules:
  - console.error(msg) → logger.error(msg)
  - console.error(msg, err) → logger.error(msg, { error: err })
  - console.warn(msg) → logger.warn(msg)
  - console.log(msg) → logger.info(msg)
  - Skips: logger.ts itself, test files, node_modules
  - Adds `import { logger } from '@/lib/logger'` if not present
  - Skips files that already import logger

Special handling:
  - Multi-line console.error calls (with object spread, etc.)
  - console.error with multiple arguments → wrap extras in { error: ... }
  - Template literals preserved
"""

import os
import re
import sys
from pathlib import Path

SKIP_DIRS = {'node_modules', '.next', '__tests__', '__mocks__', '.git'}
SKIP_FILES = {'logger.ts', 'monitoring/logger.ts'}
LOGGERS_TO_SKIP = {'console.error', 'console.warn', 'console.log'}

def should_skip(filepath):
    parts = Path(filepath).parts
    for skip in SKIP_DIRS:
        if skip in parts:
            return True
    for skip in SKIP_FILES:
        if filepath.endswith(skip):
            return True
    if filepath.endswith('.test.ts') or filepath.endswith('.test.tsx'):
        return True
    if filepath.endswith('.spec.ts') or filepath.endswith('.spec.tsx'):
        return True
    return False

def has_logger_import(content):
    return bool(re.search(r"import\s+\{[^}]*logger[^}]*\}\s+from\s+['\"]@/lib/logger['\"]", content))

def add_logger_import(content):
    # Add after the last import line
    lines = content.split('\n')
    last_import = -1
    for i, line in enumerate(lines):
        if line.startswith('import ') or (line.startswith("'use client'") and i == 0):
            if not line.startswith("'use client'"):
                last_import = i
    if last_import >= 0:
        lines.insert(last_import + 1, "import { logger } from '@/lib/logger'")
    else:
        # No imports found, add at top
        lines.insert(0, "import { logger } from '@/lib/logger'")
    return '\n'.join(lines)

def replace_console_calls(content):
    """Replace console.error/warn/log with logger.error/warn/info."""
    changes = 0
    
    # Pattern: console.error('message', optional_extra)
    # We handle single-line and multi-line (up to 3 lines) cases
    
    # Simple single-arg: console.error('message') or console.error(`template ${var}`)
    def replace_error_single(m):
        nonlocal changes
        changes += 1
        return f'logger.error({m.group(1)})'
    
    def replace_warn_single(m):
        nonlocal changes
        changes += 1
        return f'logger.warn({m.group(1)})'
    
    def replace_log_single(m):
        nonlocal changes
        changes += 1
        return f'logger.info({m.group(1)})'
    
    # Multi-arg: console.error('message', err) → logger.error('message', { error: err })
    # But if the second arg is a simple variable, wrap it
    def replace_error_multi(m):
        nonlocal changes
        changes += 1
        msg = m.group(1)
        rest = m.group(2).strip()
        if rest:
            # Check if rest is a single variable (no commas, no spaces in middle)
            if ',' not in rest and len(rest) < 100:
                return f'logger.error({msg}, {{ error: {rest} }})'
            else:
                return f'logger.error({msg}, {{ error: {rest} }})'
        return f'logger.error({msg})'
    
    # Simple patterns first (single argument)
    # console.error('string') or console.error("string") or console.error(`template`)
    
    # Single-quoted strings
    content = re.sub(
        r"console\.error\(('[^']*')\)",
        replace_error_single,
        content
    )
    content = re.sub(
        r'console\.error\(("[^"]*")\)',
        replace_error_single,
        content
    )
    content = re.sub(
        r'console\.error\((`[^`]*`)\)',
        replace_error_single,
        content
    )
    
    # console.warn
    content = re.sub(
        r"console\.warn\(('[^']*')\)",
        replace_warn_single,
        content
    )
    content = re.sub(
        r'console\.warn\(("[^"]*")\)',
        replace_warn_single,
        content
    )
    content = re.sub(
        r'console\.warn\((`[^`]*`)\)',
        replace_warn_single,
        content
    )
    
    # console.log
    content = re.sub(
        r"console\.log\(('[^']*')\)",
        replace_log_single,
        content
    )
    content = re.sub(
        r'console\.log\(("[^"]*")\)',
        replace_log_single,
        content
    )
    content = re.sub(
        r'console\.log\((`[^`]*`)\)',
        replace_log_single,
        content
    )
    
    # Multi-arg console.error('msg', extra) — be careful with template literals
    # Match: console.error("msg", something) or console.error(`msg`, something)
    # Don't match if it spans multiple lines (let those be manual)
    content = re.sub(
        r'console\.error\(([^,)]+),\s*([^)]+)\)',
        replace_error_multi,
        content
    )
    
    # Remaining simple console.error(anything) → logger.error(anything)
    # This catches cases like console.error(err) or console.error(`complex ${var}`)
    def replace_error_remaining(m):
        nonlocal changes
        arg = m.group(1)
        # If it's a bare error variable, add a message
        if arg.strip() in ('err', 'error', 'e', 'ex', 'exc'):
            changes += 1
            return f'logger.error("Error occurred", {{ error: {arg} }})'
        changes += 1
        return f'logger.error({arg})'
    
    content = re.sub(
        r'console\.error\(([^)]+)\)',
        replace_error_remaining,
        content
    )
    
    def replace_warn_remaining(m):
        nonlocal changes
        changes += 1
        return f'logger.warn({m.group(1)})'
    
    content = re.sub(
        r'console\.warn\(([^)]+)\)',
        replace_warn_remaining,
        content
    )
    
    def replace_log_remaining(m):
        nonlocal changes
        changes += 1
        return f'logger.info({m.group(1)})'
    
    content = re.sub(
        r'console\.log\(([^)]+)\)',
        replace_log_remaining,
        content
    )
    
    return content, changes

def process_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        return 0
    
    if should_skip(filepath):
        return 0
    
    new_content, changes = replace_console_calls(content)
    
    if changes == 0:
        return 0
    
    # Add logger import if needed
    if not has_logger_import(new_content):
        new_content = add_logger_import(new_content)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    return changes

def main():
    os.chdir('/home/z/my-project/repos/metardu')
    
    print("Replacing console.error/warn/log with logger calls...\n")
    
    total_changes = 0
    files_changed = 0
    
    for root, dirs, files in os.walk('src'):
        # Skip test directories
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        
        for fname in files:
            if fname.endswith(('.ts', '.tsx')):
                filepath = os.path.join(root, fname)
                changes = process_file(filepath)
                if changes > 0:
                    files_changed += 1
                    total_changes += changes
                    print(f"  ✓ {filepath}: {changes} replacements")
    
    print(f"\nTotal: {total_changes} replacements across {files_changed} files")

if __name__ == '__main__':
    main()
