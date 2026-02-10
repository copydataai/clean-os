type BookingFlowLogLevel = "log" | "warn" | "error";

function isBookingFlowDebugEnabled() {
  return process.env.BOOKING_FLOW_DEBUG === "true";
}

function emit(level: BookingFlowLogLevel, event: string, data?: Record<string, unknown>) {
  if (!isBookingFlowDebugEnabled()) {
    return;
  }
  console[level](`[BookingFlow] ${event}`, data ?? {});
}

export function bookingFlowLog(event: string, data?: Record<string, unknown>) {
  emit("log", event, data);
}

export function bookingFlowWarn(event: string, data?: Record<string, unknown>) {
  emit("warn", event, data);
}

export function bookingFlowError(event: string, data?: Record<string, unknown>) {
  emit("error", event, data);
}
