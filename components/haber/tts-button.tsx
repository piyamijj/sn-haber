'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, Square, Volume2, VolumeX } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type SpeechState = 'idle' | 'speaking' | 'paused' | 'unsupported';

interface TtsButtonProps {
  /** Seslendirilecek metin (başlık + özet + içerik düz metni). */
  text: string;
  className?: string;
}

/**
 * Haber detay sayfasında yer alan sesli okuma (TTS) butonu.
 * Tarayıcının yerel SpeechSynthesis API'sini Türkçe (tr-TR) sesle
 * kullanır — ek bir API maliyeti gerektirmez. Oynat / duraklat / durdur
 * durumlarını yönetir; tarayıcı SpeechSynthesis desteklemiyorsa
 * butonu devre dışı bırakıp açıklayıcı bir not gösterir.
 */
export function TtsButton({ text, className }: TtsButtonProps) {
  const [state, setState] = useState<SpeechState>('idle');
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setState('unsupported');
    }

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const pickTurkishVoice = useCallback((): SpeechSynthesisVoice | null => {
    const voices = window.speechSynthesis.getVoices();
    const turkishVoice = voices.find((voice) => voice.lang?.toLowerCase().startsWith('tr'));
    return turkishVoice ?? null;
  }, []);

  const handleStart = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setState('unsupported');
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'tr-TR';
    utterance.rate = 1;
    utterance.pitch = 1;

    const turkishVoice = pickTurkishVoice();
    if (turkishVoice) {
      utterance.voice = turkishVoice;
    }

    utterance.onend = () => setState('idle');
    utterance.onerror = () => setState('idle');

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setState('speaking');
  }, [text, pickTurkishVoice]);

  const handlePause = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    window.speechSynthesis.pause();
    setState('paused');
  }, []);

  const handleResume = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    window.speechSynthesis.resume();
    setState('speaking');
  }, []);

  const handleStop = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    window.speechSynthesis.cancel();
    setState('idle');
  }, []);

  if (state === 'unsupported') {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className={cn('gap-2 opacity-60', className)}
        title="Tarayıcınız sesli okuma özelliğini desteklemiyor."
      >
        <VolumeX className="h-4 w-4" aria-hidden="true" />
        Sesli okuma desteklenmiyor
      </Button>
    );
  }

  if (state === 'idle') {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleStart}
        className={cn('gap-2', className)}
      >
        <Volume2 className="h-4 w-4" aria-hidden="true" />
        Sesli Oku
      </Button>
    );
  }

  if (state === 'speaking') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Button variant="outline" size="sm" onClick={handlePause} className="gap-2">
          <Pause className="h-4 w-4" aria-hidden="true" />
          Durdur
        </Button>
        <Button variant="ghost" size="icon" onClick={handleStop} title="Sesli okumayı sonlandır">
          <Square className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  // state === 'paused'
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Button variant="outline" size="sm" onClick={handleResume} className="gap-2">
        <Play className="h-4 w-4" aria-hidden="true" />
        Devam Et
      </Button>
      <Button variant="ghost" size="icon" onClick={handleStop} title="Sesli okumayı sonlandır">
        <Square className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}