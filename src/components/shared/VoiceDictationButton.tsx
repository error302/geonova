'use client';

/**
 * VoiceDictationButton
 * ---------------------
 * Hands-free voice-to-text button designed for surveyors wearing gloves
 * in the field. Uses the browser's Web Speech API to transcribe speech
 * and append it to any text input.
 *
 * Features:
 *   - Pulsing red indicator when recording
 *   - Appends transcribed text (does NOT replace existing text)
 *   - Continuous recognition (keeps listening across sentences)
 *   - Interim results shown in lighter colour
 *   - Auto-detects language from i18n context (useLanguage)
 *   - Gracefully hides on browsers without Web Speech API support
 *   - Fully accessible with aria-label
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { Language } from '@/lib/i18n/messages';
import { logger } from '@/lib/logger'

/* ------------------------------------------------------------------ */
/*  Language mapping: i18n code → Web Speech API BCP-47 code          */
/* ------------------------------------------------------------------ */

const SPEECH_LANG_MAP: Record<string, string> = {
  en: 'en-US',
  sw: 'sw-KE',   // Swahili — Kenya
  ar: 'ar-SA',   // Arabic — Saudi Arabia
  fr: 'fr-FR',
  ha: 'ha-NG',   // Hausa — Nigeria
  pt: 'pt-PT',
  es: 'es-ES',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ru: 'ru-RU',
  hi: 'hi-IN',
  id: 'id-ID',
  am: 'am-ET',   // Amharic — Ethiopia
  de: 'de-DE',
};

function toSpeechLang(i18nCode: Language | string): string {
  return SPEECH_LANG_MAP[i18nCode] ?? `${i18nCode}-${i18nCode.toUpperCase()}`;
}

/* ------------------------------------------------------------------ */
/*  Web Speech API types (not in standard TS lib)                     */
/*  Structural declarations live in src/types/web-api.d.ts            */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export interface VoiceDictationButtonProps {
  /** Current text value of the input this button is associated with */
  value: string;
  /** Callback to update the text value */
  onChange: (value: string) => void;
  /** Override language; defaults to auto-detect from i18n context */
  language?: string;
  /** Optional additional CSS class on the wrapper */
  className?: string;
}

export function VoiceDictationButton({
  value,
  onChange,
  language,
  className,
}: VoiceDictationButtonProps) {
  /* ── i18n ──────────────────────────────────────────────────────── */
  let i18nLanguage: Language | undefined;
  let t: (key: string, values?: Record<string, string | number>) => string;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const ctx = useLanguage();
    i18nLanguage = ctx.language;
    t = ctx.t;
  } catch {
    // LanguageProvider may not be available in all contexts; that's fine
    t = (key: string) => key;
  }

  const speechLang = language ?? (i18nLanguage ? toSpeechLang(i18nLanguage) : 'en-US');

  /* ── State ─────────────────────────────────────────────────────── */
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [supported, setSupported] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const valueRef = useRef(value);

  // Keep valueRef in sync so the onresult callback always has latest text
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  /* ── Browser support check ─────────────────────────────────────── */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognitionAPI =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    setSupported(!!SpeechRecognitionAPI);
  }, []);

  /* ── Cleanup on unmount ────────────────────────────────────────── */
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
      }
    };
  }, []);

  /* ── Toggle listening ──────────────────────────────────────────── */
  const toggleListening = useCallback(() => {
    if (listening) {
      // Stop
      try { recognitionRef.current?.stop(); } catch { /* ignore */ }
      setListening(false);
      setInterimText('');
      return;
    }

    // Start
    const SpeechRecognitionAPI =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition: SpeechRecognitionLike = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = speechLang;

    let finalTranscriptAccumulated = '';

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscriptAccumulated += transcript + ' ';
        } else {
          interim += transcript;
        }
      }

      // Append final results to the actual value
      if (finalTranscriptAccumulated.trim()) {
        const current = valueRef.current;
        const separator = current.trim() ? ' ' : '';
        onChange(current.trimEnd() + separator + finalTranscriptAccumulated.trim());
        finalTranscriptAccumulated = '';
      }

      // Show interim results in lighter colour
      setInterimText(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      logger.warn('VoiceDictation error:', { error: event.error });
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setListening(false);
        setInterimText('');
      }
    };

    recognition.onend = () => {
      // If still in "listening" state (not manually stopped), restart
      // for continuous behaviour — the API can auto-stop on silence.
      setListening((prev) => {
        if (prev) {
          // Auto-restart for continuous recognition
          try { recognition.start(); } catch { /* already started */ }
        }
        return prev;
      });
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setListening(true);
    } catch (err) {
      logger.warn('VoiceDictation failed to start:', { error: err });
      setListening(false);
    }
  }, [listening, speechLang, onChange]);

  /* ── Manual stop when component unmounts or user clicks ────────── */
  const handleStop = useCallback(() => {
    setListening(false);
    setInterimText('');
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
  }, []);

  /* ── Don't render if browser doesn't support Web Speech API ────── */
  if (!supported) return null;

  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <div className={`inline-flex items-center gap-1.5 ${className ?? ''}`}>
      <button
        type="button"
        onClick={listening ? handleStop : toggleListening}
        className={[
          'relative inline-flex items-center justify-center',
          'w-10 h-10 rounded-lg transition-all touch-manipulation',
          'focus:outline-none focus:ring-2 focus:ring-offset-1',
          listening
            ? 'bg-red-500/15 text-red-500 focus:ring-red-500/40'
            : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 focus:ring-[var(--accent)]/40',
        ].join(' ')}
        aria-label={listening ? t('voiceDictation.stopDictation') : t('voiceDictation.startDictation')}
        title={listening ? t('voiceDictation.listening') : t('voiceDictation.tapToDictate')}
      >
        {/* Pulsing red ring when listening */}
        {listening && (
          <span className="absolute inset-0 rounded-lg ring-2 ring-red-500/60 animate-pulse" />
        )}

        {listening ? (
          <MicOff className="w-5 h-5 relative z-10" />
        ) : (
          <Mic className="w-5 h-5 relative z-10" />
        )}
      </button>

      {/* Listening indicator + interim text */}
      {listening && (
        <span className="flex items-center gap-1.5 text-xs select-none">
          <span className="flex items-center gap-1 text-red-500 font-medium whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            {t('voiceDictation.listening')}
          </span>
          {interimText && (
            <span className="text-[var(--text-muted)] italic truncate max-w-[140px]">
              {interimText}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
