import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { trpc } from "./lib/trpc";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./components/ui/table";
import WindMap, { type RadarLayerType } from "./components/WindMap";
import { useFavorites } from "./hooks/useFavorites";

const DEFAULT_LOCATIONS = [
  { zip: "18411", label: "Clark Summit, PA" },
  { zip: "17022", label: "Elizabethtown, PA" },
];

function getZipFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("zip");
}

function setZipInUrl(zip: string | null) {
  const url = new URL(window.location.href);
  if (zip) {
    url.searchParams.set("zip", zip);
  } else {
    url.searchParams.delete("zip");
  }
  window.history.replaceState({}, "", url.toString());
}

type ForecastPeriod = {
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
};

function getUpcomingPeriods(periods: ForecastPeriod[]) {
  const now = new Date();
  const result: ForecastPeriod[] = [];
  for (const period of periods) {
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

export default function App() {
  const { favorites, addFavorite, removeFavorite, hasFavorite } = useFavorites();
  const [zipCode, setZipCode] = useState("");
  const [submittedZip, setSubmittedZip] = useState("");
  const [showZipInput, setShowZipInput] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportStartTime, setReportStartTime] = useState("");
  const [radarLayer, setRadarLayer] = useState<RadarLayerType>("reflectivity");
  const menuRef = useRef<HTMLDivElement>(null);
  const hasSelection = submittedZip.length > 0;
  const hasFavorites = favorites.length > 0;

  useEffect(() => {
    const initialZip = getZipFromUrl();
    if (initialZip) {
      setZipCode(initialZip);
      setSubmittedZip(initialZip);
    } else if (favorites.length > 0) {
      const first = favorites[0];
      setZipCode(first.zip);
      setSubmittedZip(first.zip);
      setZipInUrl(first.zip);
    }
  }, []);

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
    (zip: string) => {
      setZipCode(zip);
      setSubmittedZip(zip);
      setZipInUrl(zip);
      setShowZipInput(false);
      setMenuOpen(false);
    },
    [],
  );

  const handleBack = useCallback(() => {
    setZipCode("");
    setSubmittedZip("");
    setZipInUrl(null);
    setShowZipInput(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = zipCode.trim();
    if (cleaned.length >= 5) {
      setSubmittedZip(cleaned);
      setZipInUrl(cleaned);
      setShowZipInput(false);
    }
  };

  const { data, isLoading, error, isError } = useQuery(
    trpc.weatherGov.getHourlyForecastForZip.queryOptions(
      { zipCode: submittedZip, units: "us" },
      { enabled: submittedZip.length > 0 },
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
    addFavorite({ zip: submittedZip, label });
  }, [data, submittedZip, addFavorite]);

  const upcomingPeriods = data
    ? getUpcomingPeriods(data.response.data.properties.periods)
    : [];
  const selectedStartIndex = Math.max(
    0,
    upcomingPeriods.findIndex((period) => period.startTime === reportStartTime),
  );
  const reportPeriods = upcomingPeriods.slice(selectedStartIndex, selectedStartIndex + 5);
  const selectedReportStartTime = reportPeriods[0]?.startTime ?? "";
  const reportMaxWind = reportPeriods.reduce<number | null>((max, period) => {
    const wind = getMaxMph(period.windSpeed);
    return wind === null ? max : Math.max(max ?? wind, wind);
  }, null);
  const reportMaxGust = reportPeriods.reduce<number | null>((max, period) => {
    const gust = getMaxMph(period.windGust);
    return gust === null ? max : Math.max(max ?? gust, gust);
  }, null);
  const reportWeather = summarizeWeather(reportPeriods);
  const windReportLevel = getWindReportLevel(reportMaxWind);

  const currentFavorite = favorites.find((f) => f.zip === submittedZip);
  const isFavorite = hasFavorite(submittedZip);

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

        {/* Location selector */}
        {!hasSelection && (
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
                    <Button
                      type="submit"
                      disabled={zipCode.trim().length < 5 || isLoading}
                    >
                      {isLoading ? "Loading..." : "Get Report"}
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
                        setZipCode(submittedZip);
                      }}
                    >
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Back to favorites
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              /* Favorites menu */
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
                                  const remaining = favorites.filter(
                                    (f) => f.zip !== fav.zip,
                                  );
                                  if (remaining.length === 0) {
                                    handleBack();
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
        )}

        {hasSelection && (
          <div className="flex items-center gap-2 -mt-4">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            {!isFavorite && data && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveFavorite}
              >
                <Star className="h-4 w-4 mr-1" />
                Save as favorite
              </Button>
            )}
            {isFavorite && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => removeFavorite(submittedZip)}
              >
                <Star className="h-4 w-4 mr-1 fill-primary text-primary" />
                Remove favorite
              </Button>
            )}
          </div>
        )}

        {isError && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{error?.message || "Failed to load wind report."}</p>
            </CardContent>
          </Card>
        )}

        {data && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-lg font-medium">
              <MapPin className="h-5 w-5 text-primary" />
              {data.location.place}, {data.location.state}
            </div>

            {/* Wind report */}
            {reportPeriods.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Wind Report
                  </h2>
                  <Label className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Start</span>
                    <select
                      className="h-9 rounded-md border bg-background px-3 text-sm font-medium"
                      value={selectedReportStartTime}
                      onChange={(event) => setReportStartTime(event.target.value)}
                    >
                      {upcomingPeriods.slice(0, 24).map((period) => (
                        <option key={period.number} value={period.startTime}>
                          {formatHourLabel(period.startTime)}
                        </option>
                      ))}
                    </select>
                  </Label>
                </div>
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <WindReportIcon icon={windReportLevel.icon} />
                      <div className="space-y-1">
                        <CardTitle className="text-lg">
                          {windReportLevel.label}
                        </CardTitle>
                        <CardDescription>
                          {formatHourLabel(reportPeriods[0]?.startTime)} through{" "}
                          {formatHourLabel(
                            reportPeriods[reportPeriods.length - 1]?.startTime,
                          )}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Max gust wind</p>
                      <p className="text-2xl font-bold">
                        {formatMph(reportMaxGust)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Max wind</p>
                      <p className="text-2xl font-bold">
                        {formatMph(reportMaxWind)}
                      </p>
                    </div>
                    <div className="space-y-1 sm:col-span-3">
                      <p className="text-sm text-muted-foreground">Weather</p>
                      <p className="text-base font-medium">{reportWeather}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Map — first on mobile, left on desktop */}
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

              {/* Forecast Table — second on mobile, right on desktop */}
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
        )}
      </div>
    </div>
  );
}
