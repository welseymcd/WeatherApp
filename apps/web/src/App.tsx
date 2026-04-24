import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wind, MapPin, Clock, Navigation, ArrowLeft } from "lucide-react";
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
import WindMap from "./components/WindMap";

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

export default function App() {
  const [zipCode, setZipCode] = useState("");
  const [submittedZip, setSubmittedZip] = useState("");
  const hasSelection = submittedZip.length > 0;

  useEffect(() => {
    const initialZip = getZipFromUrl();
    if (initialZip) {
      setZipCode(initialZip);
      setSubmittedZip(initialZip);
    }
  }, []);

  const handleSelectZip = useCallback((zip: string) => {
    setZipCode(zip);
    setSubmittedZip(zip);
    setZipInUrl(zip);
  }, []);

  const handleBack = useCallback(() => {
    setZipCode("");
    setSubmittedZip("");
    setZipInUrl(null);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = zipCode.trim();
    if (cleaned.length >= 5) {
      setSubmittedZip(cleaned);
      setZipInUrl(cleaned);
    }
  };

  const { data, isLoading, error, isError } = useQuery(
    trpc.weatherGov.getHourlyForecastForZip.queryOptions(
      { zipCode: submittedZip, units: "us" },
      { enabled: submittedZip.length > 0 },
    ),
  );

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

            {!hasSelection && (
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
            )}
          </CardContent>
        </Card>

        {hasSelection && (
          <Button variant="ghost" size="sm" onClick={handleBack} className="-mt-4">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
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
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-lg font-medium">
              <MapPin className="h-5 w-5 text-primary" />
              {data.location.place}, {data.location.state}
            </div>

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
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Forecast</TableHead>
                      <TableHead>Temperature</TableHead>
                      <TableHead>Wind Speed</TableHead>
                      <TableHead>Direction</TableHead>
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
                        <TableCell className="font-medium">
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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Wind Map
                </CardTitle>
                <CardDescription>
                  Forecast location with NOAA/NWS composite radar overlay.
                </CardDescription>
              </CardHeader>
              <CardContent>
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
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
