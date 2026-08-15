## 2024-05-24 - [DOMPurify configuration for SVG and HTML]
**Vulnerability:** XSS through dynamically generated SVG and HTML output using `dangerouslySetInnerHTML`.
**Learning:** Manual configuration of `ALLOWED_TAGS` and `ALLOWED_ATTR` in DOMPurify requires constant updates and can easily strip required attributes (e.g. styling, placement for SVGs) or fail to block sophisticated XSS patterns if misconfigured. The configuration `USE_PROFILES: { html: true, svg: true }` correctly sanitizes the input without breaking valid SVGs.
**Prevention:** Use DOMPurify's `USE_PROFILES` instead of manual allowlists to ensure SVGs and HTML render correctly and safely within `dangerouslySetInnerHTML`.
