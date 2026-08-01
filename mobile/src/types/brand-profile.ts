export interface BrandProfile {
  nameOrCompany: string;
  registration?: string;
  phone?: string;
  email?: string;
  website?: string;
  accentColor?: string;
  logoDataUri?: string;
}

export const DEFAULT_BRAND_ACCENT_COLOR = '#2563EB';

export const EMPTY_BRAND_PROFILE: BrandProfile = {
  nameOrCompany: '',
  registration: '',
  phone: '',
  email: '',
  website: '',
  accentColor: DEFAULT_BRAND_ACCENT_COLOR,
  logoDataUri: undefined,
};

export function normalizeBrandProfile(profile: Partial<BrandProfile> | null | undefined) {
  return {
    ...EMPTY_BRAND_PROFILE,
    ...profile,
    nameOrCompany: profile?.nameOrCompany?.trim() ?? '',
    registration: profile?.registration?.trim() ?? '',
    phone: profile?.phone?.trim() ?? '',
    email: profile?.email?.trim() ?? '',
    website: profile?.website?.trim() ?? '',
    accentColor: normalizeBrandAccentColor(profile?.accentColor),
    logoDataUri:
      typeof profile?.logoDataUri === 'string' && profile.logoDataUri.length > 0
        ? profile.logoDataUri
        : undefined,
  };
}

export function normalizeBrandAccentColor(value: string | undefined) {
  if (!value) return DEFAULT_BRAND_ACCENT_COLOR;
  const normalized = value.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(normalized)
    ? normalized.toUpperCase()
    : DEFAULT_BRAND_ACCENT_COLOR;
}

export function isBrandProfileComplete(profile: BrandProfile | null | undefined) {
  const normalized = normalizeBrandProfile(profile);
  const hasContact = Boolean(normalized.phone || normalized.email || normalized.website);
  return Boolean(normalized.nameOrCompany && hasContact);
}

export function getBrandProfileCompletion(profile: BrandProfile | null | undefined) {
  const normalized = normalizeBrandProfile(profile);
  const hasPhone = Boolean(normalized.phone);
  const hasEmail = Boolean(normalized.email);
  const hasWebsite = Boolean(normalized.website);
  const contactFieldCount = [hasPhone, hasEmail, hasWebsite].filter(Boolean).length;

  return {
    hasName: Boolean(normalized.nameOrCompany),
    hasContact: contactFieldCount > 0,
    hasPhone,
    hasEmail,
    hasWebsite,
    hasLogo: Boolean(normalized.logoDataUri),
    hasRegistration: Boolean(normalized.registration),
    hasCustomAccentColor: normalized.accentColor !== DEFAULT_BRAND_ACCENT_COLOR,
    contactFieldCount,
    isComplete: isBrandProfileComplete(normalized),
  };
}

export function getBrandProfileAnalyticsProperties(profile: BrandProfile | null | undefined) {
  const completion = getBrandProfileCompletion(profile);

  return {
    professional_profile_complete: completion.isComplete,
    professional_profile_has_name: completion.hasName,
    professional_profile_has_contact: completion.hasContact,
    professional_profile_has_phone: completion.hasPhone,
    professional_profile_has_email: completion.hasEmail,
    professional_profile_has_website: completion.hasWebsite,
    professional_profile_has_registration: completion.hasRegistration,
    professional_profile_has_logo: completion.hasLogo,
    professional_profile_has_custom_accent_color: completion.hasCustomAccentColor,
    professional_profile_contact_field_count: completion.contactFieldCount,
  };
}
