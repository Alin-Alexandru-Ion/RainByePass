import { zoneReference } from './zone-reference';
export function referenceForZone(zone: string) {
  const exact = zoneReference.find(r => r.zone === zone); if (exact) return exact;
  try { const canonical = new Intl.DateTimeFormat('en', { timeZone: zone }).resolvedOptions().timeZone; return zoneReference.find(r => new Intl.DateTimeFormat('en', { timeZone: r.zone }).resolvedOptions().timeZone === canonical) ?? null; } catch { return null; }
}
export const presets = [
  { label: 'Hamburg area', zone: 'Europe/Berlin', latitude: 53.55, longitude: 10, reference: 'Approximate Hamburg coordinates, Plants in urban environments, section 4.2.1: https://pure.mpg.de/rest/items/item_2243358_1/component/file_2243357/content' },
  ...['Europe/Berlin', 'Europe/London', 'America/New_York', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Honolulu', 'Pacific/Kiritimati'].map(zone => ({ ...referenceForZone(zone)!, label: `${zone.split('/').at(-1)!.replaceAll('_', ' ')} (zone reference)`, reference: 'IANA public-domain zone1970.tab representative location, not exact city/geolocation.' })),
  { label: 'Tromsø area (polar example)', zone: 'Europe/Oslo', latitude: 69.65, longitude: 18.96, reference: 'Approximate regional example coordinates selected for polar behavior; not exact geolocation.' }
];
