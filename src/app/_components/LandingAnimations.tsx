'use client';

/**
 * Landing page animations — v0.3 redesign.
 *
 * AnimatedOrbs is GONE (banned by taste-skill as AI fingerprint).
 * Replaced with SurveyorCrosshair — a static, SVG crosshair / coordinate
 * grid decoration that evokes the surveyor's working surface without
 * being a generic SaaS orb animation.
 *
 * ConnectingLine kept as a thin solid accent rule (no gradient).
 *
 * ponytail: extracting these keeps the 800-LOC landing page as RSC.
 */

import { motion } from 'framer-motion'

// ─── Surveyor crosshair (static, replaces AnimatedOrbs) ─────────────────────

export function AnimatedOrbs() {
  // v0.3: AnimatedOrbs is now a no-op — the orbs were banned by taste-skill.
  // Kept the export name so the landing page import doesn't break.
  // The visual decoration is now SurveyorCrosshair (see below).
  return null
}

export function SurveyorCrosshair() {
  return (
    <svg
      className="absolute right-0 top-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-[0.08] pointer-events-none"
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="100" cy="100" r="98" stroke="var(--accent)" strokeWidth="0.4" />
      <circle cx="100" cy="100" r="80" stroke="var(--accent)" strokeWidth="0.4" strokeDasharray="2 3" />
      <circle cx="100" cy="100" r="60" stroke="var(--accent)" strokeWidth="0.4" />
      <circle cx="100" cy="100" r="40" stroke="var(--accent)" strokeWidth="0.4" strokeDasharray="1 2" />
      <circle cx="100" cy="100" r="3" fill="var(--accent)" />
      <line x1="0" y1="100" x2="200" y2="100" stroke="var(--accent)" strokeWidth="0.4" />
      <line x1="100" y1="0" x2="100" y2="200" stroke="var(--accent)" strokeWidth="0.4" />
      <line x1="29" y1="29" x2="171" y2="171" stroke="var(--accent)" strokeWidth="0.3" />
      <line x1="171" y1="29" x2="29" y2="171" stroke="var(--accent)" strokeWidth="0.3" />
    </svg>
  )
}

// ─── Scroll-reveal accent rule (no gradient) ────────────────────────────────

export function ConnectingLine() {
  return (
    <motion.div
      className="h-px bg-[color-mix(in_srgb,var(--accent)_40%,transparent)]"
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, delay: 0.3 }}
      style={{ transformOrigin: 'left' }}
    />
  )
}
