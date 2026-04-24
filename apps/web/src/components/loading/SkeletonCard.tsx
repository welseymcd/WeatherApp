export function SkeletonCard({ children }: { children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-4 animate-pulse">
      <div className="h-5 w-1/3 bg-muted rounded" />
      <div className="h-4 w-2/3 bg-muted rounded" />
      {children}
    </div>
  );
}
