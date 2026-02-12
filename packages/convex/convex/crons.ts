import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "expire-sent-quotes",
  { hours: 1 },
  internal.quotes.expireSentQuotesSweep,
  {}
);

crons.interval(
  "send-due-quote-reminders",
  { hours: 1 },
  internal.quoteReminderActions.sendDueQuoteReminders,
  {}
);

crons.interval(
  "dispatch-geocode-sweep",
  { minutes: 15 },
  internal.schedule.dispatchGeocodeSweepInternal,
  {
    seedLimit: 250,
    processLimit: 250,
  }
);

export default crons;
