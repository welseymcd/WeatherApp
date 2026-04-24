# NOAA and NWS GIS Map Services

Last verified: 2026-04-24

Primary sources:
- https://www.weather.gov/gis
- https://www.weather.gov/gis/cloudgiswebservices
- https://opengeo.ncep.noaa.gov/geoserver/www/index.html
- https://www.nauticalcharts.noaa.gov/learn/nowcoast.html

## What These Services Are

NOAA and NWS expose weather map data through GIS services separate from the main `api.weather.gov` REST API.

Use `api.weather.gov` for structured JSON forecast, alert, observation, station, zone, and office data. Use NOAA/NWS GIS services for map layers such as radar imagery, warning polygons, forecast grids, marine/coastal layers, and other geospatial overlays.

The main NWS GIS entrypoints are:

- NWS GIS portal: `https://www.weather.gov/gis`
- NWS CloudGIS web services: `https://www.weather.gov/gis/cloudgiswebservices`
- NWS GeoServer radar and alert directory: `https://opengeo.ncep.noaa.gov/geoserver/www/index.html`
- NWS GIS viewer: `https://viewer.weather.noaa.gov/general`

## Service Types

NWS CloudGIS services follow Open Geospatial Consortium standards:

- `WMS`: Web Map Service. Returns rendered map images. Use this for radar and other visual overlays in a web map.
- `WFS`: Web Feature Service. Returns vector features. Use this when the app needs geometries and attributes, such as warning polygons.
- `WCS`: Web Coverage Service. Returns gridded/coverage data. Use this for more advanced raster data workflows.

For this project, WMS and WFS are the likely starting points.

## Important Distinction From api.weather.gov

The `api.weather.gov` `/radar` endpoints are not display-ready radar map endpoints. The NWS API documentation says those endpoints are for radar status data and points developers to radar display, OGC web services, MRMS data, and archives for imagery.

Practical rule:

- Forecasts, current conditions, active alerts, stations: use `api.weather.gov` through this app's Worker adapter.
- Radar, warning polygons, map overlays: use NWS/NOAA GIS services.

## Useful NWS GeoServer Layers

The NWS GeoServer directory lists the currently available radar and alert services.

### Alert Layers

- Hazards: long-duration advisories, watches, and warnings
- Warnings: short-fuse warnings such as flash flood, severe thunderstorm, tornado, and special marine warnings

These are available as WFS and WMS from the GeoServer directory.

### Composite Radar Layers

Composite radar imagery is produced by MRMS and exposed as WMS layers for:

- CONUS
- Alaska
- Hawaii
- Caribbean
- Guam

Common layer families listed by NWS include:

- `BREF QCD`: base reflectivity quality-controlled
- `CREF QCD`: composite reflectivity quality-controlled
- `NEET V18`
- `PCPN TYP`: precipitation type

Example CONUS base reflectivity WMS capabilities URL:

```text
https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows?service=wms&version=1.3.0&request=GetCapabilities
```

At verification time this capabilities document advertised:

- WMS version `1.3.0`
- layer name `conus_bref_qcd`
- image output including `image/png`
- CRS support including `EPSG:3857`, `EPSG:4326`, `EPSG:4269`, and `CRS:84`
- a time dimension with recent radar frames

### Individual Radar Site Layers

NWS also lists NEXRAD and TDWR radar site services. NEXRAD products include:

- `SR_BREF`: super resolution base reflectivity
- `SR_BVEL`: super resolution base radial velocity
- `BDHC`: digital hydrometeor classification
- `BOHA`: one-hour rainfall accumulation
- `BDSA`: storm-total rainfall accumulation

Use individual radar site layers when the UI needs station-specific radar rather than a national/regional composite.

## WMS Request Pattern

Start with `GetCapabilities`. Do not hard-code layer names, styles, supported CRS values, or time behavior until the capabilities response has been inspected.

Capabilities request:

```text
https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows?service=wms&version=1.3.0&request=GetCapabilities
```

Generic `GetMap` shape:

```text
https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows
  ?service=WMS
  &version=1.3.0
  &request=GetMap
  &layers=conus_bref_qcd
  &styles=
  &format=image/png
  &transparent=true
  &crs=EPSG:3857
  &bbox={minX},{minY},{maxX},{maxY}
  &width=256
  &height=256
```

Notes:

- For WMS 1.3.0, axis order can vary by CRS. `EPSG:3857` is usually simpler for web maps than `EPSG:4326`.
- Add `time={isoTimestamp}` only after reading the `Dimension name="time"` values from `GetCapabilities`.
- Use `transparent=true` for radar or warning overlays placed on top of a base map.
- Prefer `image/png` for overlays with transparency.

## Leaflet Example

Leaflet can consume WMS overlays directly with `L.tileLayer.wms`.

```ts
const radar = L.tileLayer.wms(
  "https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows",
  {
    service: "WMS",
    version: "1.3.0",
    layers: "conus_bref_qcd",
    styles: "",
    format: "image/png",
    transparent: true,
    opacity: 0.65,
    attribution: "NOAA/NWS",
  },
);

radar.addTo(map);
```

For animation, fetch and parse `GetCapabilities`, extract the available `time` values, then update the WMS layer params:

```ts
radar.setParams({ time: selectedIsoTime });
```

## OpenLayers Example

OpenLayers has first-class WMS support.

```ts
import TileLayer from "ol/layer/Tile";
import TileWMS from "ol/source/TileWMS";

const radarLayer = new TileLayer({
  opacity: 0.65,
  source: new TileWMS({
    url: "https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows",
    params: {
      SERVICE: "WMS",
      VERSION: "1.3.0",
      LAYERS: "conus_bref_qcd",
      STYLES: "",
      FORMAT: "image/png",
      TRANSPARENT: true,
    },
    attributions: "NOAA/NWS",
  }),
});
```

## WFS Usage Pattern

Use WFS when the app needs geometry and properties instead of a rendered image. Warning and hazard polygons are the most likely use case.

Generic `GetFeature` shape:

```text
https://opengeo.ncep.noaa.gov/geoserver/{workspace}/{layer}/ows
  ?service=WFS
  &version=2.0.0
  &request=GetFeature
  &typeNames={workspace}:{layerName}
  &outputFormat=application/json
```

Implementation notes:

- Confirm the exact `typeNames` value from the WFS `GetCapabilities` response.
- Prefer GeoJSON output when available.
- Clip or filter server-side when supported; warning polygons can become large.
- Treat warning polygons from WFS as map geometry. Treat alert details from `api.weather.gov` as the user-facing alert text source unless the WFS attributes are explicitly sufficient.

## NOAA nowCOAST

NOAA nowCOAST is another GIS-based map platform that provides oceanographic, meteorological, and hydrologic map layers. NOAA describes it as supporting observations, analyses, forecasts, alerts, weather radar mosaics, satellite cloud imagery, watches and warnings, marine weather, tropical cyclone forecasts, ocean model guidance, and bathymetry-related layers.

Use nowCOAST when the app needs coastal, marine, oceanographic, or bathymetric context beyond the core NWS forecast workflow.

Start here:

- nowCOAST overview: `https://www.nauticalcharts.noaa.gov/learn/nowcoast.html`
- nowCOAST viewer: `https://nowcoast.noaa.gov/`

## Recommended Use In This Project

This repository currently has a server-side `api.weather.gov` adapter and a `/weather/gov/*` proxy. That proxy should stay focused on the JSON REST API.

For GIS map layers:

1. Keep structured forecast and alert workflows on the existing Worker-backed `api.weather.gov` path.
2. Add a dedicated GIS service module only when the app needs map overlays.
3. For browser map rendering, use a map library such as Leaflet or OpenLayers and consume WMS as raster overlays.
4. If the app needs auditability, stable caching, same-origin controls, or custom rate limiting, add a separate Worker route such as `/noaa/gis/*` instead of mixing GIS behavior into `/weather/gov/*`.
5. Store only metadata needed by the app, such as selected layer id, source URL, capabilities fetch time, available times, and chosen opacity. Do not store map image tiles in D1.

Suggested first map feature:

1. Base map from a normal tile provider.
2. CONUS `conus_bref_qcd` WMS overlay for radar.
3. Active alerts from `api.weather.gov` for text and alert state.
4. Optional WFS warning polygons for precise on-map geometry.

## Operational Caveats

- Always read `GetCapabilities`; NWS can add, rename, or retire layers.
- Time-enabled layers should be treated as dynamic. Refresh capabilities periodically rather than assuming a fixed frame cadence.
- WMS images are not JSON and should not go through the existing weather.gov JSON parser.
- Respect cache headers where provided.
- Attribute NOAA/NWS data in the map UI.
- Expect public-service rate limits or operational interruptions even when no key is required.
- Keep a fallback UI for when a map layer fails while the structured forecast still works.

## Quick Decision Matrix

| Need | Use |
| --- | --- |
| 7-day forecast | `api.weather.gov` `/points` then linked `forecast` |
| Hourly forecast | `api.weather.gov` linked `forecastHourly` |
| Current conditions | `api.weather.gov` stations and latest observation |
| Alert text | `api.weather.gov` active alerts |
| Radar image overlay | NWS GeoServer WMS |
| Warning polygons | NWS GeoServer WFS or WMS, depending on whether vectors are needed |
| Coastal/marine map context | NOAA nowCOAST |
| Historical radar archive | MRMS/NODD archive sources, not the live REST forecast API |
