/**
 * Get localized field based on language
 */
export function getLocalizedField(field: any, locale: string = 'en'): string {
  if (!field || typeof field !== 'object') return field || '';
  if (field[locale]) return field[locale];
  return field.en || '';
}

/**
 * Normalize array-like or object-like structures into arrays
 */
function normalizeArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

/**
 * Get localized document
 */
export function getLocalizedDocument(item: any, locale: string = 'en'): any {
  if (!item) return item;

  const localizedItem = {
    ...(item.toObject ? item.toObject() : item),
    title: getLocalizedField(item.title, locale),
    location: getLocalizedField(item.location, locale),
    developer: getLocalizedField(item.developer, locale),
    description: getLocalizedField(item.description, locale)
  };

  // ✅ Normalize arrays to prevent React runtime errors
  localizedItem.images = normalizeArray(item.images);
  localizedItem.amenities = normalizeArray(item.amenities);
  // Floor Plans - Commented Out
  // localizedItem.floorPlans = normalizeArray(item.floorPlans);
  localizedItem.nearbyLandmarks = normalizeArray(item.nearbyLandmarks);

  // ✅ Localize nearby landmarks
  localizedItem.nearbyLandmarks = localizedItem.nearbyLandmarks.map((landmark: any) => ({
    ...landmark,
    title: getLocalizedField(landmark.title, locale)
  }));

  // Floor Plans Localization - Commented Out
  // localizedItem.floorPlans = localizedItem.floorPlans.map((plan: any) => ({
  //   ...plan,
  //   title: getLocalizedField(plan.title, locale)
  // }));

  // ✅ Localize SEO
  if (item.seo) {
    localizedItem.seo = {
      ...item.seo,
      title: getLocalizedField(item.seo.title, locale),
      description: getLocalizedField(item.seo.description, locale)
    };
  }

  return localizedItem;
}

/**
 * Get localized data for multiple documents
 */
export function getLocalizedDocuments(items: any[], locale: string = 'en'): any[] {
  return items.map(item => getLocalizedDocument(item, locale));
}

/**
 * Create multi-language object for database storage
 */
export function createMultiLangObject(
  enText: string,
  translations: { fr?: string; es?: string } = {}
): any {
  return {
    en: enText,
    fr: translations.fr,
    es: translations.es
  };
}
