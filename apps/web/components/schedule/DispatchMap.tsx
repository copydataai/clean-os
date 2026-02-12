"use client";

import { useEffect, useMemo, useState } from "react";
import { Map as MapboxMap, Layer, Marker, Source, ViewState } from "react-map-gl/mapbox";
import type { LayerProps } from "react-map-gl/mapbox";
import type { Id } from "@clean-os/convex/data-model";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DispatchBooking, DispatchRouteSuggestion } from "./types";

type DispatchMapProps = {
  bookings: DispatchBooking[];
  selectedBookingId: Id<"bookings"> | null;
  onSelectBooking: (bookingId: Id<"bookings">) => void;
  routeSuggestion?: DispatchRouteSuggestion | null;
  routeLoading?: boolean;
  routeError?: string | null;
  applyingRoute?: boolean;
  onRequestRoute?: () => void;
  onApplyRoute?: () => Promise<void> | void;
};

const FALLBACK_VIEW: Pick<ViewState, "latitude" | "longitude" | "zoom"> = {
  latitude: 39.5,
  longitude: -98.35,
  zoom: 3.3,
};
const MAP_PANEL_HEIGHT_CLASS = "h-[clamp(24rem,68vh,40rem)]";

const ROUTE_HALO_LAYER: LayerProps = {
  id: "dispatch-route-halo",
  type: "line",
  paint: {
    "line-color": "#0f172a",
    "line-width": 9,
    "line-opacity": 0.18,
  },
};

const ROUTE_LINE_LAYER: LayerProps = {
  id: "dispatch-route-core",
  type: "line",
  paint: {
    "line-color": "#0f766e",
    "line-width": 5,
    "line-opacity": 0.92,
  },
};

function hasCoordinates(booking: DispatchBooking): boolean {
  return (
    typeof booking.location.latitude === "number" &&
    typeof booking.location.longitude === "number"
  );
}

function averageCoordinates(bookings: DispatchBooking[]) {
  if (bookings.length === 0) return FALLBACK_VIEW;
  const sum = bookings.reduce(
    (acc, booking) => {
      acc.latitude += booking.location.latitude ?? 0;
      acc.longitude += booking.location.longitude ?? 0;
      return acc;
    },
    { latitude: 0, longitude: 0 }
  );
  return {
    latitude: sum.latitude / bookings.length,
    longitude: sum.longitude / bookings.length,
    zoom: 10.5,
  };
}

function markerTone(booking: DispatchBooking, selected: boolean) {
  if (selected) return "bg-primary text-primary-foreground border-primary";
  if (booking.dispatchPriority === "urgent") return "bg-rose-500 text-white border-rose-700";
  if (booking.dispatchPriority === "high") return "bg-amber-500 text-amber-950 border-amber-700";
  return "bg-emerald-500 text-emerald-950 border-emerald-700";
}

function formatRouteDistance(meters: number | null): string {
  if (meters === null) return "--";
  return `${(meters / 1609.34).toFixed(1)} mi`;
}

function formatRouteDuration(seconds: number | null): string {
  if (seconds === null) return "--";
  const totalMinutes = Math.max(Math.round(seconds / 60), 0);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export default function DispatchMap({
  bookings,
  selectedBookingId,
  onSelectBooking,
  routeSuggestion = null,
  routeLoading = false,
  routeError = null,
  applyingRoute = false,
  onRequestRoute,
  onApplyRoute,
}: DispatchMapProps) {
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const mappableBookings = useMemo(
    () => bookings.filter((booking) => hasCoordinates(booking)),
    [bookings]
  );

  const selectedBooking = useMemo(
    () => mappableBookings.find((booking) => booking._id === selectedBookingId) ?? null,
    [mappableBookings, selectedBookingId]
  );

  const routeOrderByBookingId = useMemo(() => {
    const map = new Map<Id<"bookings">, number>();
    routeSuggestion?.orderedBookingIds.forEach((bookingId, index) => {
      map.set(bookingId, index + 1);
    });
    return map;
  }, [routeSuggestion]);

  const routeGeoJson = useMemo(() => {
    if (!routeSuggestion || routeSuggestion.routeCoordinates.length < 2) return null;
    return {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: routeSuggestion.routeCoordinates,
      },
    };
  }, [routeSuggestion]);

  const [viewState, setViewState] = useState<Pick<ViewState, "latitude" | "longitude" | "zoom">>(
    averageCoordinates(mappableBookings)
  );

  useEffect(() => {
    if (mappableBookings.length === 0) {
      setViewState(FALLBACK_VIEW);
      return;
    }

    if (selectedBooking?.location.latitude && selectedBooking.location.longitude) {
      setViewState((current) => ({
        latitude: selectedBooking.location.latitude as number,
        longitude: selectedBooking.location.longitude as number,
        zoom: Math.max(current.zoom, 11),
      }));
      return;
    }

    setViewState(averageCoordinates(mappableBookings));
  }, [mappableBookings, selectedBooking]);

  const routedCount = routeSuggestion?.orderedBookingIds.length ?? 0;
  const unroutedStops =
    (routeSuggestion?.skippedBookingIds.length ?? 0) +
    (routeSuggestion?.unmappedBookingIds.length ?? 0);
  const canApplyRoute = Boolean(onApplyRoute && routedCount > 1);

  const routeSummaryText = routeError
    ? routeError
    : routeLoading
    ? "Optimizing route..."
    : routeSuggestion
    ? `${formatRouteDuration(routeSuggestion.totalDurationSeconds)} • ${formatRouteDistance(
        routeSuggestion.totalDistanceMeters
      )}`
    : "Route suggestion unavailable";

  if (!mapboxToken) {
    return (
      <div
        className={cn(
          "surface-card flex items-center justify-center border-border/70 bg-[linear-gradient(150deg,color-mix(in_oklch,var(--card)_90%,white),color-mix(in_oklch,var(--muted)_35%,white))] p-8 text-center",
          MAP_PANEL_HEIGHT_CLASS
        )}
      >
        <div>
          <p className="text-sm font-semibold text-foreground">Map unavailable</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Set `NEXT_PUBLIC_MAPBOX_TOKEN` to render dispatch pins.
          </p>
        </div>
      </div>
    );
  }

  if (mappableBookings.length === 0) {
    return (
      <div
        className={cn(
          "surface-card flex items-center justify-center border-border/70 bg-[linear-gradient(150deg,color-mix(in_oklch,var(--card)_90%,white),color-mix(in_oklch,var(--muted)_35%,white))] p-8 text-center",
          MAP_PANEL_HEIGHT_CLASS
        )}
      >
        <div>
          <p className="text-sm font-semibold text-foreground">No map pins yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Dispatch entries exist, but none include geocoded coordinates.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use "Refresh map data" above to queue geocoding jobs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section
      className={cn(
        "surface-card relative overflow-hidden border-border/80 p-0",
        MAP_PANEL_HEIGHT_CLASS
      )}
    >
      <MapboxMap
        mapboxAccessToken={mapboxToken}
        mapStyle="mapbox://styles/mapbox/navigation-day-v1"
        longitude={viewState.longitude}
        latitude={viewState.latitude}
        zoom={viewState.zoom}
        onMove={(event) => {
          const { longitude, latitude, zoom } = event.viewState;
          setViewState({ longitude, latitude, zoom });
        }}
        style={{ width: "100%", height: "100%" }}
      >
        {routeGeoJson ? (
          <Source id="dispatch-route" type="geojson" data={routeGeoJson}>
            <Layer {...ROUTE_HALO_LAYER} />
            <Layer {...ROUTE_LINE_LAYER} />
          </Source>
        ) : null}

        {mappableBookings.map((booking, index) => (
          <Marker
            key={booking._id}
            longitude={booking.location.longitude as number}
            latitude={booking.location.latitude as number}
            anchor="bottom"
          >
            <button
              type="button"
              onClick={() => onSelectBooking(booking._id)}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-semibold shadow-[0_8px_22px_-12px_rgba(0,0,0,0.55)] transition hover:scale-105",
                markerTone(booking, selectedBookingId === booking._id),
                routeOrderByBookingId.has(booking._id) ? "ring-2 ring-background/80" : ""
              )}
              aria-label={`Select booking ${booking._id}`}
              title={booking.customerName ?? booking.email}
            >
              {routeOrderByBookingId.get(booking._id) ?? (booking.dispatchOrder ?? index) + 1}
            </button>
          </Marker>
        ))}
      </MapboxMap>

      <div className="absolute left-3 right-3 top-3 rounded-xl border border-border/70 bg-background/92 px-3 py-2.5 text-xs shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-foreground">
              {mappableBookings.length} mapped stops
              {routeSuggestion ? ` • ${routedCount} routed` : ""}
            </p>
            <p className={cn("mt-0.5 text-muted-foreground", routeError ? "text-rose-700 dark:text-rose-300" : "")}>
              {routeSummaryText}
            </p>
            {routeSuggestion ? (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {unroutedStops > 0 ? `${unroutedStops} stops not routed` : "All mapped stops included"}
                {routeSuggestion.provider === "mapbox"
                  ? " • Mapbox directions"
                  : routeSuggestion.tokenConfigured
                  ? " • Fallback geometry"
                  : " • No directions token"}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setViewState(averageCoordinates(mappableBookings))}
            >
              Reset view
            </Button>
            {onRequestRoute ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onRequestRoute}
                disabled={routeLoading}
              >
                {routeLoading ? "Optimizing..." : "Refresh route"}
              </Button>
            ) : null}
            {onApplyRoute ? (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  void onApplyRoute();
                }}
                disabled={!canApplyRoute || routeLoading || applyingRoute}
              >
                {applyingRoute ? "Applying..." : "Apply route"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {selectedBooking ? (
        <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-border/70 bg-background/92 p-3 text-xs shadow-sm backdrop-blur">
          <p className="font-semibold text-foreground">
            {selectedBooking.customerName ?? selectedBooking.email}
            {routeOrderByBookingId.has(selectedBooking._id)
              ? ` • Stop ${routeOrderByBookingId.get(selectedBooking._id)}`
              : ""}
          </p>
          <p className="mt-1 text-muted-foreground">{selectedBooking.location.addressLine || "No address"}</p>
          <p className="mt-1 text-muted-foreground">
            Priority: {selectedBooking.dispatchPriority} | Assignments: {selectedBooking.assignments.assigned}
          </p>
        </div>
      ) : null}
    </section>
  );
}
