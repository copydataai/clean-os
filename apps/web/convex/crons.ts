import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "expire-sent-quotes",
  { hours: 1 },
  internal.quotes.expireSentQuotesSweep,
  {}
);

export default crons;

