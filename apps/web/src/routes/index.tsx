import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Wind,
  MapPin,
  Clock,
  Navigation,
  ArrowLeft,
  ChevronDown,
  Star,
  Plus,
  X,
  Heart,
  Sailboat,
  Fish,
  Waves,
  Anchor,
  Radar,
  Gauge,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useFavorites } from "@/hooks/useFavorites";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import WindMap, { type RadarLayerType } from "@/components/WindMap";
import { SkeletonCard } from "@/components/loading/SkeletonCard";
import { MapSkeleton } from "@/components/loading/MapSkeleton";
import { TableSkeleton } from "@/components/loading/TableSkeleton";

const DEFAULT_LOCATIONS = [
  { zip: "18411", label: "Clark Summit, PA" },
  { zip: "17022", label: "Elizabethtown, PA" },
];

function getNext5Periods(
  periods: Array<{
    number: number;
    name?: string;
    startTime?: string;
    endTime?: string;
    shortForecast?: string;
    temperature?: number;
    temperatureUnit?: string;
    windSpeed?: string;
    windGust?: string;
    windDirection?: string;
    icon?: string;
  }>,
) {
  const now = new Date();
  const result = [];
  for (const period of periods) {
    if (result.length >= 5) break;
    const start = period.startTime ? new Date(period.startTime) : null;
    const end = period.endTime ? new Date(period.endTime) : null;
    if (start && end) {
      if (end > now) {
        result.push(period);
      }
    } else if (start && start >= now) {
      result.push(period);
    }
  }
  return result;
}

function getMaxMph(value?: string): number | null {
  if (!value) return null;
  const matches = value.match(/\d+/g);
  if (!matches) return null;
  return Math.max(...matches.map((match) => Number(match)));
}

function formatMph(value: number | null): string {
  return value === null ? "Not listed" : `${value} mph`;
}

type WindReportLevel = {
  label: string;
  icon: "none" | "carp" | "bottom" | "mixed" | "river" | "calm";
};

function getWindReportLevel(windMph: number | null): WindReportLevel {
  if (windMph === null) {
    return { label: "No wind level available.", icon: "calm" };
  }
  if (windMph >= 15) {
    return { label: "No boat, No fish.", icon: "none" };
  }
  if (windMph >= 10) {
    return { label: "Boat, maybe. Fish for carp", icon: "carp" };
  }
  if (windMph >= 7) {
    return { label: "Boat or Kayak. Bottom fishing", icon: "bottom" };
  }
  if (windMph >= 4) {
    return { label: "Boat or Kayak. All fish free game", icon: "mixed" };
  }
  if (windMph >= 1) {
    return { label: "Boat or Kaya, Bass River", icon: "river" };
  }
  return { label: "Calm conditions", icon: "calm" };
}

function summarizeWeather(periods: Array<{ shortForecast?: string }>): string {
  const unique = Array.from(
    new Set(
      periods
        .map((period) => period.shortForecast)
        .filter((forecast): forecast is string => Boolean(forecast)),
    ),
  );
  return unique.length > 0 ? unique.join(", ") : "Not listed";
}

function WindReportIcon({ icon }: { icon: WindReportLevel["icon"] }) {
  if (icon === "none") {
    return (
      <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <Sailboat className="h-6 w-6" />
        <X className="absolute right-1 top-1 h-4 w-4" />
      </span>
    );
  }
  if (icon === "carp") {
    return (
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-700">
        <Fish className="h-6 w-6" />
      </span>
    );
  }
  if (icon === "bottom") {
    return (
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-700">
        <Anchor className="h-6 w-6" />
      </span>
    );
  }
  if (icon === "mixed") {
    return (
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700">
        <Sailboat className="h-6 w-6" />
      </span>
    );
  }
  if (icon === "river") {
    return (
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-700">
        <Waves className="h-6 w-6" />
      </span>
    );
  }
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <Wind className="h-6 w-6" />
    </span>
  );
}

function formatHourLabel(startTime?: string): string {
  if (!startTime) return "—";
  const d = new Date(startTime);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    hour12: true,
  });
}

function WindReportView({ zip }: { zip: string }) {
  const { favorites, addFavorite, removeFavorite, hasFavorite } = useFavorites();
  const navigate = useNavigate({ from: "/" });
  const [radarLayer, setRadarLayer] = useState<RadarLayerType>("reflectivity");

  const {
    data,
    isLoading,
    error,
    isError,
  } = useQuery(
    trpc.weatherGov.getHourlyForecastForZip.queryOptions(
      { zipCode: zip, units: "us" },
      { enabled: zip.length > 0 },
    ),
  );

  const { data: radarStationRaw } = useQuery(
    trpc.weatherGov.getNearestRadarStation.queryOptions(
      {
        latitude: data?.location.latitude ?? 0,
        longitude: data?.location.longitude ?? 0,
      },
      { enabled: !!data },
    ),
  );

  const radarStation = radarStationRaw as
    | { properties?: { id?: string; name?: string; stationType?: string } }
    | null
    | undefined;

  const handleSaveFavorite = useCallback(() => {
    if (!data) return;
    const label = `${data.location.place}, ${data.location.state}`;
    addFavorite({ zip, label });
  }, [data, zip, addFavorite]);

  const handleBack = useCallback(() => {
    navigate({ search: (prev) => ({ ...prev, zip: undefined }) });
  }, [navigate]);

  const handleSelectZip = useCallback(
    (newZip: string) => {
      navigate({ search: (prev) => ({ ...prev, zip: newZip }) });
    },
    [navigate],
  );

  const next5 = data ? getNext5Periods(data.response.data.properties.periods) : [];
  const next5MaxWind = next5.reduce<number | null>((max, period) => {
    const wind = getMaxMph(period.windSpeed);
    return wind === null ? max : Math.max(max ?? wind, wind);
  }, null);
  const next5MaxGust = next5.reduce<number | null>((max, period) => {
    const gust = getMaxMph(period.windGust);
    return gust === null ? max : Math.max(max ?? gust, gust);
  }, null);
  const next5Weather = summarizeWeather(next5);
  const next5ReportLevel = getWindReportLevel(next5MaxWind);

  const isFavorite = hasFavorite(zip);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-lg font-medium">
          <MapPin className="h-5 w-5 text-primary" />
          <div className="h-5 w-48 bg-muted rounded animate-pulse" />
        </div>

        <div className="space-y-3">
          <div className="h-7 w-40 bg-muted rounded animate-pulse" />
          <SkeletonCard>
            <div className="h-20 bg-muted/50 rounded" />
          </SkeletonCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="h-6 w-32 bg-muted rounded animate-pulse" />
            <MapSkeleton />
          </div>
          <div className="space-y-3">
            <div className="h-6 w-32 bg-muted rounded animate-pulse" />
            <TableSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{error?.message || "Failed to load wind report."}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-lg font-medium">
        <MapPin className="h-5 w-5 text-primary" />
        {data.location.place}, {data.location.state}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        {!isFavorite && (
          <Button variant="outline" size="sm" onClick={handleSaveFavorite}>
            <Star className="h-4 w-4 mr-1" />
            Save as favorite
          </Button>
        )}
        {isFavorite && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => removeFavorite(zip)}
          >
            <Star className="h-4 w-4 mr-1 fill-primary text-primary" />
            Remove favorite
          </Button>
        )}
      </div>

      {next5.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Next 5 Hours
          </h2>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <WindReportIcon icon={next5ReportLevel.icon} />
                <div className="space-y-1">
                  <CardTitle className="text-lg">
                    {next5ReportLevel.label}
                  </CardTitle>
                  <CardDescription>
                    {formatHourLabel(next5[0]?.startTime)} through{" "}
                    {formatHourLabel(next5[next5.length - 1]?.startTime)}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Max gust wind</p>
                <p className="text-2xl font-bold">{formatMph(next5MaxGust)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Max wind</p>
                <p className="text-2xl font-bold">{formatMph(next5MaxWind)}</p>
              </div>
              <div className="space-y-1 sm:col-span-3">
                <p className="text-sm text-muted-foreground">Weather</p>
                <p className="text-base font-medium">{next5Weather}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radar className="h-5 w-5" />
              Radar View
              {radarStation?.properties?.id && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({radarStation.properties.id})
                </span>
              )}
            </CardTitle>
            <CardDescription>
              Toggle between reflectivity and base velocity from the nearest radar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={radarLayer === "reflectivity" ? "default" : "outline"}
                size="sm"
                onClick={() => setRadarLayer("reflectivity")}
              >
                <Radar className="h-4 w-4 mr-1" />
                Reflectivity
              </Button>
              <Button
                variant={radarLayer === "velocity" ? "default" : "outline"}
                size="sm"
                onClick={() => setRadarLayer("velocity")}
              >
                <Gauge className="h-4 w-4 mr-1" />
                Base Velocity
              </Button>
            </div>
            <WindMap
              latitude={data.location.latitude}
              longitude={data.location.longitude}
              windSpeed={
                (
                  data.response.data.properties.periods[0] as
                    | { windSpeed?: string }
                    | undefined
                )?.windSpeed
              }
              windDirection={
                (
                  data.response.data.properties.periods[0] as
                    | { windDirection?: string }
                    | undefined
                )?.windDirection
              }
              radarLayer={radarLayer}
              radarStationId={radarStation?.properties?.id ?? null}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Hourly Forecast
            </CardTitle>
            <CardDescription>
              Wind speed, direction, and temperature for the next 24 hours.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Forecast</TableHead>
                  <TableHead>Temp</TableHead>
                  <TableHead>Wind</TableHead>
                  <TableHead>Dir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.response.data.properties.periods.map((period: {
                  number: number;
                  name?: string;
                  startTime?: string;
                  shortForecast?: string;
                  temperature?: number;
                  temperatureUnit?: string;
                  windSpeed?: string;
                  windDirection?: string;
                }) => (
                  <TableRow key={period.number}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {period.name ||
                        new Date(period.startTime || "").toLocaleString()}
                    </TableCell>
                    <TableCell>{period.shortForecast}</TableCell>
                    <TableCell>
                      {period.temperature}°{period.temperatureUnit}
                    </TableCell>
                    <TableCell>{period.windSpeed}</TableCell>
                    <TableCell className="flex items-center gap-1">
                      <Navigation className="h-4 w-4" />
                      {period.windDirection}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LocationSelector({ zip }: { zip?: string }) {
  const { favorites, removeFavorite } = useFavorites();
  const navigate = useNavigate({ from: "/" });
  const [zipCode, setZipCode] = useState(zip ?? "");
  const [showZipInput, setShowZipInput] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasFavorites = favorites.length > 0;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [menuOpen]);

  const handleSelectZip = useCallback(
    (newZip: string) => {
      navigate({ search: (prev) => ({ ...prev, zip: newZip }) });
      setShowZipInput(false);
      setMenuOpen(false);
    },
    [navigate],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = zipCode.trim();
    if (cleaned.length >= 5) {
      navigate({ search: (prev) => ({ ...prev, zip: cleaned }) });
      setShowZipInput(false);
    }
  };

  const currentFavorite = favorites.find((f) => f.zip === zip);

  return (
    <>
      {(!hasFavorites || showZipInput) ? (
        <Card>
          <CardHeader>
            <CardTitle>Location</CardTitle>
            <CardDescription>
              Enter a zip code to lookup wind conditions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="flex items-end gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor="zip">Zip Code</Label>
                <Input
                  id="zip"
                  type="text"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  placeholder="e.g. 90210"
                  maxLength={10}
                />
              </div>
              <Button type="submit" disabled={zipCode.trim().length < 5}>
                Get Report
              </Button>
            </form>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Quick select</p>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_LOCATIONS.map((loc) => (
                  <Button
                    key={loc.zip}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSelectZip(loc.zip)}
                  >
                    {loc.label} ({loc.zip})
                  </Button>
                ))}
              </div>
            </div>

            {hasFavorites && showZipInput && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowZipInput(false);
                  setZipCode(zip ?? "");
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to favorites
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Location</CardTitle>
            <CardDescription>
              Select a saved location or enter a new one.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative" ref={menuRef}>
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => setMenuOpen((o) => !o)}
              >
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {currentFavorite
                    ? `${currentFavorite.label} (${currentFavorite.zip})`
                    : "Select a location"}
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${menuOpen ? "rotate-180" : ""}`}
                />
              </Button>

              {menuOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-lg">
                  <div className="p-1">
                    {favorites.map((fav) => (
                      <div
                        key={fav.zip}
                        className="flex items-center justify-between rounded-sm px-2 py-1.5 hover:bg-accent cursor-pointer"
                        onClick={() => handleSelectZip(fav.zip)}
                      >
                        <span className="flex items-center gap-2 text-sm">
                          <Heart className="h-3.5 w-3.5 text-primary" />
                          {fav.label} ({fav.zip})
                        </span>
                        <button
                          className="ml-2 rounded p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFavorite(fav.zip);
                            if (favorites.length <= 1) {
                              setShowZipInput(true);
                            }
                          }}
                          title="Remove favorite"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <div className="my-1 border-t" />
                    <button
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                      onClick={() => {
                        setMenuOpen(false);
                        setShowZipInput(true);
                        setZipCode("");
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Enter new location
                    </button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function IndexPage() {
  const search = Route.useSearch();
  const zip = search.zip;

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Wind className="h-8 w-8 text-primary" />
            Hourly Wind Report
          </h1>
          <p className="text-muted-foreground">
            Enter a US zip code to get the hourly wind forecast.
          </p>
        </div>

        {zip ? <WindReportView zip={zip} /> : <LocationSelector zip={zip} />}
      </div>
    </div>
  );
}

function PendingView() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Wind className="h-8 w-8 text-primary" />
            Hourly Wind Report
          </h1>
          <p className="text-muted-foreground">
            Enter a US zip code to get the hourly wind forecast.
          </p>
        </div>
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-lg font-medium">
            <MapPin className="h-5 w-5 text-primary" />
            <div className="h-5 w-48 bg-muted rounded animate-pulse" />
          </div>
          <div className="space-y-3">
            <div className="h-7 w-40 bg-muted rounded animate-pulse" />
            <SkeletonCard>
              <div className="h-20 bg-muted/50 rounded" />
            </SkeletonCard>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="h-6 w-32 bg-muted rounded animate-pulse" />
              <MapSkeleton />
            </div>
            <div className="space-y-3">
              <div className="h-6 w-32 bg-muted rounded animate-pulse" />
              <TableSkeleton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: IndexPage,
  validateSearch: (search: Record<string, unknown>) => ({
    zip: typeof search.zip === "string" ? search.zip : undefined,
  }),
  loaderDeps: ({ search: { zip } }) => ({ zip }),
  loader: async ({ deps: { zip }, context }) => {
    if (!zip) return null;
    await context.queryClient.ensureQueryData(
      trpc.weatherGov.getHourlyForecastForZip.queryOptions({
        zipCode: zip,
        units: "us",
      }),
    );
    return { zip };
  },
  pendingComponent: PendingView,
  staleTime: 30_000,
  preload: true,
});
