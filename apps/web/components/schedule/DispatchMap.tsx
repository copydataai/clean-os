"use client";

import { useEffect, useMemo, useState } from "react";
import Map, { Marker, ViewState } from "react-map-gl/mapbox";
import type { Id } from "@clean-os/convex/data-model";
import { DispatchBooking } from "./types";

type DispatchMapProps = {
  bookings: DispatchBooking[];
  selectedBookingId: Id<"bookings"> | null;
  onSelectBooking: (bookingId: Id<"bookings">) => void;
};

const FALLBACK_VIEW: Pick<ViewState, "latitude" | "longitude" | "zoom"> = {
  latitude: 39.5,
  longitude: -98.35,
  zoom: 3.3,
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

export default function DispatchMap({
  bookings,
  selectedBookingId,
  onSelectBooking,
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

  if (!mapboxToken) {
    return (
      <div className="surface-card flex min-h-[640px] items-center justify-center border-border/70 bg-[linear-gradient(150deg,color-mix(in_oklch,var(--card)_90%,white),color-mix(in_oklch,var(--muted)_35%,white))] p-8 text-center">
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
      <div className="surface-card flex min-h-[640px] items-center justify-center border-border/70 bg-[linear-gradient(150deg,color-mix(in_oklch,var(--card)_90%,white),color-mix(in_oklch,var(--muted)_35%,white))] p-8 text-center">
        <div>
          <p className="text-sm font-semibold text-foreground">No map pins yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Dispatch entries exist, but none include geocoded coordinates.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="surface-card relative min-h-[640px] overflow-hidden border-border/80 p-0">
      <Map
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
              className={`flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-semibold shadow-[0_8px_22px_-12px_rgba(0,0,0,0.55)] transition hover:scale-105 ${markerTone(
                booking,
                selectedBookingId === booking._id
              )}`}
              aria-label={`Select booking ${booking._id}`}
              title={booking.customerName ?? booking.email}
            >
              {(booking.dispatchOrder ?? index) + 1}
            </button>
          </Marker>
        ))}
      </Map>

      <div className="absolute left-3 top-3 rounded-xl border border-border/70 bg-background/90 px-3 py-2 text-xs shadow-sm backdrop-blur">
        <p className="font-semibold text-foreground">{mappableBookings.length} mapped stops</p>
        <p className="text-muted-foreground">Tap a marker to focus the route card.</p>
      </div>

      {selectedBooking ? (
        <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-border/70 bg-background/92 p-3 text-xs shadow-sm backdrop-blur">
          <p className="font-semibold text-foreground">{selectedBooking.customerName ?? selectedBooking.email}</p>
          <p className="mt-1 text-muted-foreground">{selectedBooking.location.addressLine || "No address"}</p>
          <p className="mt-1 text-muted-foreground">
            Priority: {selectedBooking.dispatchPriority} | Assignments: {selectedBooking.assignments.assigned}
          </p>
        </div>
      ) : null}
    </section>
  );
}
