import type { z } from "zod";
import type { leads } from "@/db/schema";
import type {
  negotiationEnumSchema,
  placesApiResponseSchema,
  searchLeadsSchema,
  updateLeadSchema,
} from "@/schemas";

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;

export type NegotiationStatus = z.infer<typeof negotiationEnumSchema>;
export type SearchLeadsRequest = z.infer<typeof searchLeadsSchema>;
export type UpdateLeadRequest = z.infer<typeof updateLeadSchema>;
export type PlacesApiResponse = z.infer<typeof placesApiResponseSchema>;

export interface GooglePlaceResult {
  placeId: string;
  name: string;
  phone: string | null;
  websiteUrl: string | null;
  hasWebsite: boolean;
  category: string;
  city: string;
}

export interface WebsiteAnalysis {
  email: string | null;
  hasChatbot: boolean | null;
  chatbotVendor: string | null;
}

export interface ChatbotSignature {
  vendor: string;
  patterns: RegExp[];
}
