## 2026-08-08 - SVG Injection via dangerouslySetInnerHTML
**Vulnerability:** XSS in DeedPlanGenerator and MutationPlanGenerator through untrusted inputs reflecting inside user-controlled dynamic SVG.
**Learning:** Even dynamically constructed SVGs using valid domain-specific variables might carry payloads from project names, identifiers, or other user input if they are not explicitly escaped or the entire SVG string is not sanitized before being rendered with `dangerouslySetInnerHTML`.
**Prevention:** Always use `@/lib/security/sanitize` to sanitize untrusted or dynamically built SVGs when assigning them to React elements through `dangerouslySetInnerHTML`.
