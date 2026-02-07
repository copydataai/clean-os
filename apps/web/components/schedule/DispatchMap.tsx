"use client";

import { useEffect, useMemo, useState } from "react";
import Map, { Marker, ViewState } from "react-map-gl/mapbox";
import { Id } from "@/convex/_generated/dataModel";
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

  const [viewState, setViewState] = useState<Pick<ViewState, "latitude" | "longitude" | "zoom">>(
    averageCoordinates(mappableBookings)
  );

  useEffect(() => {
    if (mappableBookings.length === 0) {
      setViewState(FALLBACK_VIEW);
      return;
    }
    const selected = mappableBookings.find((booking) => booking._id === selectedBookingId);
    if (selected?.location.latitude && selected.location.longitude) {
      setViewState({
        latitude: selected.location.latitude,
        longitude: selected.location.longitude,
        zoom: Math.max(viewState.zoom, 11),
      });
      return;
    }
    setViewState(averageCoordinates(mappableBookings));
  }, [mappableBookings, selectedBookingId, viewState.zoom]);

  if (!mapboxToken) {
    return (
      <div className="surface-card flex h-[620px] items-center justify-center p-8 text-center">
        <div>
          <p className="text-sm font-medium text-foreground">Map unavailable</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Set NEXT_PUBLIC_MAPBOX_TOKEN to render dispatch map pins.
          </p>
        </div>
      </div>
    );
  }

  if (mappableBookings.length === 0) {
    return (
      <div className="surface-card flex h-[620px] items-center justify-center p-8 text-center">
        <div>
          <p className="text-sm font-medium text-foreground">No map pins yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            This day has bookings, but none have geocoded coordinates.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="surface-card relative h-[620px] overflow-hidden p-0">
      <Map
        mapboxAccessToken={mapboxToken}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        longitude={viewState.longitude}
        latitude={viewState.latitude}
        zoom={viewState.zoom}
        onMove={(event) => {
          const { longitude, latitude, zoom } = event.viewState;
          setViewState({ longitude, latitude, zoom });
        }}
        style={{ width: "100%", height: "100%" }}
      >
        {mappableBookings.map((booking) => (
          <Marker
            key={booking._id}
            longitude={booking.location.longitude as number}
            latitude={booking.location.latitude as number}
            anchor="bottom"
          >
            <button
              type="button"
              onClick={() => onSelectBooking(booking._id)}
              className={`h-4 w-4 rounded-full border-2 border-white shadow ${
                selectedBookingId === booking._id ? "bg-primary" : "bg-emerald-500"
              }`}
              aria-label={`Select booking ${booking._id}`}
            />
          </Marker>
        ))}
      </Map>

      <div className="absolute left-3 top-3 rounded-lg bg-background/95 px-3 py-2 text-xs text-foreground shadow">
        {mappableBookings.length} mapped stop{mappableBookings.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
