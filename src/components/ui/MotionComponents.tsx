'use client';

import { useEffect, useRef, useState } from "react";
import {
  motion,
  type HTMLMotionProps,
  useInView,
} from "framer-motion";
import { cn } from "@/lib/utils";
import {
  fadeUpVariant,
  fadeInVariant,
  scaleVariant,
  slideInLeft,
  slideInRight,
  springSmooth,
  springBouncy,
} from "@/lib/utils";

/* ========================================================================
   Shared viewport options – trigger before element is fully in view
   ======================================================================== */
const VIEWPORT = { once: true, margin: "-100px" } as const;

/* ========================================================================
   FadeUp – fade in + slide up on scroll
   ======================================================================== */
export function FadeUp({
  children,
  className,
  delay = 0,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
} & Omit<HTMLMotionProps<"div">, "children">) {
  return (
    <motion.div
      variants={fadeUpVariant}
      custom={delay}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/* ========================================================================
   FadeIn – simple fade
   ======================================================================== */
export function FadeIn({
  children,
  className,
  delay = 0,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
} & Omit<HTMLMotionProps<"div">, "children">) {
  return (
    <motion.div
      variants={fadeInVariant}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      transition={{ delay }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/* ========================================================================
   ScaleIn – scale + fade entrance
   ======================================================================== */
export function ScaleIn({
  children,
  className,
  delay = 0,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
} & Omit<HTMLMotionProps<"div">, "children">) {
  return (
    <motion.div
      variants={scaleVariant}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      transition={{ delay }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/* ========================================================================
   StaggerContainer – wraps children with staggered entrance
   ======================================================================== */
export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.08,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
} & Omit<HTMLMotionProps<"div">, "children">) {
  return (
    <motion.div
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: staggerDelay, delayChildren: 0.1 },
        },
      }}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/* ========================================================================
   SlideIn – slide from left or right
   ======================================================================== */
export function SlideIn({
  children,
  className,
  direction = "left",
  delay = 0,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  direction?: "left" | "right";
  delay?: number;
} & Omit<HTMLMotionProps<"div">, "children">) {
  const variant = direction === "left" ? slideInLeft : slideInRight;
  return (
    <motion.div
      variants={variant}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      transition={{ delay }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/* ========================================================================
   GlassCard – glassmorphism card with hover lift
   ======================================================================== */
export function GlassCard({
  children,
  className,
  hover = true,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  // v0.3: GlassCard is now an alias for PaperCard — flat, no glassmorphism.
  // Kept the export name so existing imports don't break.
  return (
    <motion.div
      whileHover={
        hover
          ? {
              y: -2,
              transition: springSmooth,
            }
          : undefined
      }
      className={cn(
        "bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg",
        hover &&
          "transition-colors duration-200 hover:border-[var(--border-hover)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.3)]",
        className
      )}
      {...(({ onDrag: _onDrag, onDragStart: _onDragStart, onDragEnd: _onDragEnd, onAnimationStart: _onAnimationStart, onAnimationEnd: _onAnimationEnd, onAnimationIteration: _onAnimationIteration, ...rest }: React.HTMLAttributes<HTMLDivElement>) => rest)(props)}
    >
      {children}
    </motion.div>
  );
}

/* ========================================================================
   AnimatedGradientText – now solid accent color, no gradient (v0.3)
   ======================================================================== */
export function AnimatedGradientText({
  children,
  className,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  from: _from,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  via: _via,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  to: _to,
}: {
  children: React.ReactNode;
  className?: string;
  from?: string;
  via?: string;
  to?: string;
}) {
  // v0.3: gradient text is banned by impeccable skill. Solid accent color instead.
  return (
    <span
      className={cn(
        "inline-block text-[var(--accent)]",
        className
      )}
    >
      {children}
    </span>
  );
}

export function GlowButton({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  // v0.3: GlowButton is now a flat primary button — no gradient, no glow.
  // Kept the export name so existing imports don't break.
  return (
    <motion.div
      whileHover={{ scale: 1.01, transition: springSmooth }}
      whileTap={{ scale: 0.98 }}
      transition={springBouncy}
      className={cn(
        "inline-flex items-center justify-center rounded-md",
        "bg-[var(--accent)] text-[var(--bg-primary)] font-medium",
        "transition-colors duration-200 ease-out",
        "hover:bg-[var(--accent-dim)]",
        className
      )}
      {...(({ onDrag: _onDrag, onDragStart: _onDragStart, onDragEnd: _onDragEnd, onAnimationStart: _onAnimationStart, onAnimationEnd: _onAnimationEnd, onAnimationIteration: _onAnimationIteration, ...rest }: React.HTMLAttributes<HTMLDivElement>) => rest)(props)}
    >
      {children}
    </motion.div>
  );
}

/* ========================================================================
   SectionReveal – wraps a section to reveal on scroll
   ======================================================================== */
export function SectionReveal({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{
        duration: 0.7,
        ease: [0.25, 0.4, 0.25, 1],
      }}
      className={cn(className)}
    >
      {children}
    </motion.section>
  );
}

/* ========================================================================
   CounterAnimation – animated number counter
   ======================================================================== */
export function CounterAnimation({
  target,
  suffix = "",
  className,
}: {
  target: number;
  suffix?: string;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (prefersReducedMotion) {
        setDisplayValue(target);
        return;
      }
    }

    let animationFrame = 0;
    let startTime: number | null = null;
    const duration = 2000;

    setDisplayValue(0);

    const step = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      setDisplayValue(target * easedProgress);

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(step);
      }
    };

    animationFrame = window.requestAnimationFrame(step);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [target]);

  return (
    <span className={cn("tabular-nums", className)}>
      {displayValue.toFixed(target % 1 !== 0 ? 1 : 0)}
      {suffix}
    </span>
  );
}

/* ========================================================================
   TypewriterText – text that appears character by character
   ======================================================================== */
export function TypewriterText({
  text,
  words,
  className,
  delay = 0,
  speed = 30,
}: {
  text?: string;
  words?: string[];
  className?: string;
  delay?: number;
  speed?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [displayed, setDisplayed] = useState("");
  const [wordIndex, setWordIndex] = useState(0);

  // Resolve the current text to type
  const currentText = text ?? (words ? words[wordIndex % words.length] : "");

  useEffect(() => {
    if (!isInView || !currentText) return;

    let index = 0;
    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        if (index < currentText.length) {
          setDisplayed(currentText.slice(0, index + 1));
          index++;
        } else {
          clearInterval(interval);
          // If cycling through words, move to next after a pause
          if (words && words.length > 1) {
            setTimeout(() => {
              setWordIndex(prev => (prev + 1) % words.length);
              setDisplayed("");
            }, 1500);
          }
        }
      }, speed);

      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(timeout);
  }, [isInView, currentText, delay, speed, words]);

  return (
    <span ref={ref} className={cn("inline", className)}>
      {displayed}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
        className="inline-block ml-[1px] w-[2px] h-[1em] bg-[var(--accent)] align-middle"
      >
        &nbsp;
      </motion.span>
    </span>
  );
}
