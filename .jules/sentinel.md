## 2024-10-24 - DOMPurify Profile Configuration and Trusted Data Sanitization

**Vulnerability:**
The DOMPurify configuration was overly restrictive for SVGs by using manually constructed arrays for `ALLOWED_TAGS` and `ALLOWED_ATTRS`. This required maintaining a fragile allowlist for SVG drawing geometries, which previously led to stripping valid chart elements. Moreover, trusted static server data (like beacon symbol SVGs) were being unnecessarily sanitized, risking SSR hydration mismatches in React without providing security value.

**Learning:**
DOMPurify provides robust profile-based validation out-of-the-box (`USE_PROFILES: { html: true, svg: true }`). It is significantly safer and easier to use these built-in profiles and exclusively forbid specific dangerous SVG tags/attributes (like `<image>`, `<foreignObject>`, and `href` attributes) rather than maintaining an extensive allowlist. Also, applying `sanitizeHtml` to trusted, statically generated enums/SVGs provides no security benefit while increasing overhead and creating SSR hydration issues.

**Prevention:**
Rely on DOMPurify profiles combined with `FORBID_TAGS` and `FORBID_ATTR` when handling SVGs instead of manually configuring allowlists. Always differentiate between user-provided untrusted data (which must be sanitized) and server-generated trusted static data (which shouldn't be).
