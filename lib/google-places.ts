import { placesApiResponseSchema } from "@/schemas";
import type { GooglePlaceResult } from "@/types";

const PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

// Usiamo FieldMask per richiedere SOLO i campi necessari ed evitare addebiti inutili
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.primaryTypeDisplayName",
  "nextPageToken",
].join(",");

export async function searchGooglePlaces(
  category: string,
  city: string,
  maxPages = 1
): Promise<GooglePlaceResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_PLACES_API_KEY non configurata nel file .env");
  }

  const textQuery = `${category} ${city}`.trim();
  const results: GooglePlaceResult[] = [];
  let pageToken: string | undefined = undefined;

  for (let page = 0; page < maxPages; page++) {
    const response = await fetch(PLACES_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery,
        languageCode: "it",
        pageSize: 20,
        ...(pageToken ? { pageToken } : {}),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Errore Google Places API (${response.status}): ${errorText}`
      );
    }

    const rawData = await response.json();
    const data = placesApiResponseSchema.parse(rawData);
    const places = data.places ?? [];

    for (const place of places) {
      if (!place.id || !place.displayName?.text) continue;

      const websiteUrl = place.websiteUri ?? null;

      results.push({
        placeId: place.id,
        name: place.displayName.text,
        phone:
          place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
        websiteUrl,
        hasWebsite: Boolean(websiteUrl),
        category: place.primaryTypeDisplayName?.text ?? category,
        city,
      });
    }

    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  return results;
}
