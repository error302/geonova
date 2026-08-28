## 2025-02-25 - Missing SVG sanitization issue in generated output components

**Vulnerability:**
Stored Cross-Site Scripting (XSS) vulnerability was found in the `DeedPlanGenerator` and `MutationPlanGenerator` components due to direct rendering of user-generated/dynamic SVG content using `dangerouslySetInnerHTML`.

**Learning:**
React's `dangerouslySetInnerHTML` should never be used without properly sanitizing the input, particularly when rendering content generated dynamically on the client side (e.g. from user input). `sanitizeHtml` function must be utilized consistently across all dynamically rendered content in `dangerouslySetInnerHTML`.

**Prevention:**
Enforce usage of `sanitizeHtml` from `@/lib/security/sanitize` wrapper for any `dangerouslySetInnerHTML` execution involving dynamic content.
