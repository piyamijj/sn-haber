'use client';

import { useEffect, useState } from 'react';

/**
 * Birincil giriş yönteminin "coarse" (dokunmatik/parmak) bir işaretçi
 * olup olmadığını tespit eder. Mobil/dokunmatik cihazlarda gerçek bir
 * "mouseleave" olayı olmadığından, Framer Motion'ın whileHover'a bağlı
 * "üzerine gelince durdur" davranışı dokunma/kaydırma sonrası kalıcı
 * olarak takılı kalabilir — bu da kayan bantların (marquee) mobilde
 * donmuş/çok yavaş görünmesine sebep olan gerçek kök nedendi.
 *
 * SSR sırasında/ilk render'da false döner (hydration uyumsuzluğunu
 * önlemek için), mount sonrası gerçek değerle güncellenir.
 */
export function useCoarsePointer(): boolean {
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia('(pointer: coarse)');
    setIsCoarsePointer(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setIsCoarsePointer(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isCoarsePointer;
}