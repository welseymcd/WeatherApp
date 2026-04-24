export function TableSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex gap-2">
        <div className="h-8 flex-1 bg-muted rounded" />
        <div className="h-8 flex-1 bg-muted rounded" />
        <div className="h-8 flex-1 bg-muted rounded" />
        <div className="h-8 flex-1 bg-muted rounded" />
        <div className="h-8 flex-1 bg-muted rounded" />
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-2">
          <div className="h-10 flex-1 bg-muted/60 rounded" />
          <div className="h-10 flex-1 bg-muted/60 rounded" />
          <div className="h-10 flex-1 bg-muted/60 rounded" />
          <div className="h-10 flex-1 bg-muted/60 rounded" />
          <div className="h-10 flex-1 bg-muted/60 rounded" />
        </div>
      ))}
    </div>
  );
}
