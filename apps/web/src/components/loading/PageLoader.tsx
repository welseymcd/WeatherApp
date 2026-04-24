import { Wind } from "lucide-react";

export function PageLoader() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <Wind className="h-12 w-12 text-primary animate-pulse" />
        <div className="absolute inset-0 h-12 w-12 rounded-full bg-primary/20 animate-ping" />
      </div>
      <p className="text-muted-foreground text-sm animate-pulse">Loading forecast data...</p>
    </div>
  );
}
