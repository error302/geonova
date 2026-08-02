#!/bin/bash
for file in $(find src/app/map -type f -name "*.tsx" -o -name "*.ts"); do
  # Replace bg-[var(--bg-card)]/xx with solid bg-[var(--bg-card)]
  sed -i -E 's/bg-\[var\(--bg-card\)]\/[0-9]+/bg-[var(--bg-card)]/g' "$file"
  # Replace bg-[var(--bg-secondary)]/xx with solid bg-[var(--bg-secondary)]
  sed -i -E 's/bg-\[var\(--bg-secondary\)]\/[0-9]+/bg-[var(--bg-secondary)]/g' "$file"
  # Replace bg-[var(--bg-primary)]/xx with solid bg-[var(--bg-primary)]
  sed -i -E 's/bg-\[var\(--bg-primary\)]\/[0-9]+/bg-[var(--bg-primary)]/g' "$file"
  # Replace bg-white/xx with solid backgrounds (or bg-white) depending on the context. Let's just remove glassmorphism.
  sed -i 's/backdrop-blur-md//g' "$file"
  sed -i 's/backdrop-blur-xl//g' "$file"
  sed -i 's/backdrop-blur-2xl//g' "$file"
  sed -i 's/backdrop-blur-sm//g' "$file"
  sed -i 's/backdrop-blur-lg//g' "$file"
done
