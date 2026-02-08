export const REQUIRED_SERVICE_TYPES = ["standard", "deep", "move_out"] as const;

export const LOW_AVERAGE_RATING_THRESHOLD = 4.3;
export const DECLINING_DELTA_THRESHOLD = -0.4;

type ServiceQualification = {
  serviceType: string;
  isQualified: boolean;
};

type RatingsHealthInput = {
  average: number | null;
  delta30d: number | null;
};

export type CleanerReadinessInsights = {
  score: number;
  flags: string[];
  missingServiceTypes: string[];
  ratingHealth: RatingsHealthInput;
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export function formatPayRate(
  baseRate: number,
  payType: string,
  currency = "USD"
): string {
  const normalizedType = payType.toLowerCase();
  if (normalizedType === "hourly" || normalizedType === "per_job") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(baseRate / 100);
  }
  if (normalizedType === "commission") {
    return `${baseRate}%`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(baseRate / 100);
}

export function buildRatingsHealthFlags(input: RatingsHealthInput): string[] {
  const flags: string[] = [];
  if (input.average !== null && input.average < LOW_AVERAGE_RATING_THRESHOLD) {
    flags.push("Low average rating");
  }
  if (input.delta30d !== null && input.delta30d <= DECLINING_DELTA_THRESHOLD) {
    flags.push("Rating declining (30d)");
  }
  return flags;
}

export function computeReadinessInsights(args: {
  serviceQualifications: ServiceQualification[];
  hasActivePayRate: boolean;
  ratingHealth: RatingsHealthInput;
}): CleanerReadinessInsights {
  const qualifiedSet = new Set(
    args.serviceQualifications
      .filter((qualification) => qualification.isQualified)
      .map((qualification) => qualification.serviceType.toLowerCase())
  );

  const missingServiceTypes = REQUIRED_SERVICE_TYPES.filter(
    (serviceType) => !qualifiedSet.has(serviceType)
  );

  const flags: string[] = [];
  if (!args.hasActivePayRate) {
    flags.push("No active pay rate");
  }
  for (const serviceType of missingServiceTypes) {
    flags.push(`Missing qualification: ${serviceType}`);
  }
  flags.push(...buildRatingsHealthFlags(args.ratingHealth));

  const serviceCoverageRatio =
    (REQUIRED_SERVICE_TYPES.length - missingServiceTypes.length) /
    REQUIRED_SERVICE_TYPES.length;

  const serviceScore = serviceCoverageRatio * 50;
  const payScore = args.hasActivePayRate ? 20 : 0;
  const ratingScore =
    args.ratingHealth.average === null
      ? 20
      : clamp((args.ratingHealth.average / 5) * 20, 0, 20);
  const trendScore =
    args.ratingHealth.delta30d === null
      ? 10
      : args.ratingHealth.delta30d <= DECLINING_DELTA_THRESHOLD
        ? 0
        : 10;

  return {
    score: Math.round(clamp(serviceScore + payScore + ratingScore + trendScore)),
    flags,
    missingServiceTypes,
    ratingHealth: args.ratingHealth,
  };
}

export function computeRatingsWindowSummary(
  ratings: Array<{ overallRating: number; createdAt: number }>,
  now: number
): {
  average: number | null;
  average30d: number | null;
  previousAverage30d: number | null;
  delta30d: number | null;
  totalCount: number;
} {
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const currentWindowStart = now - thirtyDaysMs;
  const previousWindowStart = now - 2 * thirtyDaysMs;

  const average = (values: number[]) =>
    values.length === 0
      ? null
      : values.reduce((sum, value) => sum + value, 0) / values.length;

  const all = ratings.map((rating) => rating.overallRating);
  const current = ratings
    .filter((rating) => rating.createdAt >= currentWindowStart)
    .map((rating) => rating.overallRating);
  const previous = ratings
    .filter(
      (rating) =>
        rating.createdAt >= previousWindowStart &&
        rating.createdAt < currentWindowStart
    )
    .map((rating) => rating.overallRating);

  const average30d = average(current);
  const previousAverage30d = average(previous);
  return {
    average: average(all),
    average30d,
    previousAverage30d,
    delta30d:
      average30d !== null && previousAverage30d !== null
        ? average30d - previousAverage30d
        : null,
    totalCount: ratings.length,
  };
}
