'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 bg-oled px-4 py-16 text-center">
      <h2 className="text-2xl font-bold text-foreground">Bir şeyler ters gitti</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Sayfa yüklenirken beklenmeyen bir hata oluştu. Lütfen tekrar deneyin; sorun
        devam ederse bir süre sonra yeniden ziyaret edebilirsiniz.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-2 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Tekrar dene
      </button>
    </div>
  );
}