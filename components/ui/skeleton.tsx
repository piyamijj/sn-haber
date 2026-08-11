import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('skeleton-shimmer rounded-md bg-oled-panel2', className)}
      {...props}
    />
  );
}

export { Skeleton };