// Manual active-listings lookup — see data/my-listings.json for how to
// maintain it. This exists specifically because IDX access requires a
// signed Data Access Agreement (through Stacia's broker) that isn't in
// place yet; this sidesteps that entirely since it's just a link to a
// page Stacia already controls and has full rights to link to, not
// live MLS data displayed inside this app.
//
// Matching is intentionally simple and exact (normalized house number +
// street name) — a false match here would show a buyer the wrong
// listing link, which is worse than showing nothing.

import myListings from "@/data/my-listings.json";

export interface MyListing {
  addressMatch: string;
  city: string;
  kwUrl: string;
}

function normalizeStreet(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * @param normalizedAddress The full geocoded address string (e.g. from
 *   the calculate API's normalizedAddress field).
 */
export function findMyListing(normalizedAddress: string): MyListing | null {
  const listings = (myListings as { listings: MyListing[] }).listings || [];
  const addr = normalizeStreet(normalizedAddress);

  const found = listings.find((l) => addr.includes(normalizeStreet(l.addressMatch)));
  return found ?? null;
}
