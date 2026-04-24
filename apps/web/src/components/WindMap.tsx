import { useEffect, useRef } from "react";
import L from "leaflet";

interface WindMapProps {
  latitude: number;
  longitude: number;
  windSpeed?: string;
  windDirection?: string;
}

export default function WindMap({
  latitude,
  longitude,
  windSpeed,
  windDirection,
}: WindMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
    }

    const map = L.map(mapRef.current).setView([latitude, longitude], 9);
    leafletMapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    const radarLayer = L.tileLayer.wms(
      "https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows",
      {
        version: "1.3.0",
        layers: "conus_bref_qcd",
        styles: "",
        format: "image/png",
        transparent: true,
        opacity: 0.65,
        attribution: "NOAA/NWS",
      },
    );
    radarLayer.addTo(map);

    const marker = L.marker([latitude, longitude]).addTo(map);

    let popupContent = `<strong>Forecast Location</strong><br/>${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    if (windSpeed || windDirection) {
      popupContent += "<br/><br/>";
      if (windSpeed) popupContent += `Wind: ${windSpeed}<br/>`;
      if (windDirection) popupContent += `Direction: ${windDirection}`;
    }
    marker.bindPopup(popupContent).openPopup();

    return () => {
      map.remove();
      leafletMapRef.current = null;
    };
  }, [latitude, longitude, windSpeed, windDirection]);

  return <div ref={mapRef} className="w-full h-96 rounded-lg border" />;
}
