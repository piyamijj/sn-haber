import { Skeleton } from '@/components/ui/skeleton';

/**
 * Sayfa geçişleri/akış (streaming) sırasında gösterilen genel yükleme
 * arayüzü. Anasayfadaki haber akışı düzenini taklit eden bir iskelet
 * (skeleton) gösterir: kategori sekmeleri şeridi + responsive grid
 * içinde 6 haber kartı iskeleti.
 */
export default function Loading() {
  return (
    <div className="container flex flex-col gap-6 py-6">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-24 shrink-0 rounded-md" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex flex-col gap-3">
            <Skeleton className="aspect-[16/9] w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}