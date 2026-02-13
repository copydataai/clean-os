export type EmailBrand = {
  displayName?: string;
  logoUrl?: string;
  iconUrl?: string;
  brandColor?: string;
  accentColor?: string;
  tagline?: string;
  email?: string;
};

export function extractBrandFromProfile(profile: any): EmailBrand | undefined {
  if (!profile) return undefined;
  const brand: EmailBrand = {};
  if (profile.displayName) brand.displayName = profile.displayName;
  if (profile.logoUrl) brand.logoUrl = profile.logoUrl;
  if (profile.iconUrl) brand.iconUrl = profile.iconUrl;
  if (profile.brandColor) brand.brandColor = profile.brandColor;
  if (profile.accentColor) brand.accentColor = profile.accentColor;
  if (profile.tagline) brand.tagline = profile.tagline;
  if (profile.email) brand.email = profile.email;
  return Object.keys(brand).length > 0 ? brand : undefined;
}
