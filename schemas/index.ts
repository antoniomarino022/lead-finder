import { z } from "zod";

export const negotiationEnumSchema = z.enum([
  "in_progress",
  "closed",
  "rejected",
]);

export const searchLeadsSchema = z.object({
  category: z
    .string()
    .trim()
    .min(2, "La categoria deve contenere almeno 2 caratteri"),
  city: z
    .string()
    .trim()
    .min(2, "La città deve contenere almeno 2 caratteri"),
  maxPages: z.number().int().min(1).max(5).default(1),
  analyzeWebsites: z.boolean().default(true),
});

export const updateLeadSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().trim().email("Email non valida").nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  category: z.string().trim().nullable().optional(),
  city: z.string().trim().nullable().optional(),
  websiteUrl: z.string().trim().url("URL non valido").nullable().optional(),
  hasWebsite: z.boolean().optional(),
  hasChatbot: z.boolean().nullable().optional(),
  chatbotVendor: z.string().trim().nullable().optional(),
  contacted: z.boolean().optional(),
  negotiation: negotiationEnumSchema.nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const placesApiResponseSchema = z.object({
  places: z
    .array(
      z.object({
        id: z.string(),
        displayName: z
          .object({
            text: z.string(),
            languageCode: z.string().optional(),
          })
          .optional(),
        nationalPhoneNumber: z.string().optional(),
        internationalPhoneNumber: z.string().optional(),
        websiteUri: z.string().optional(),
        primaryTypeDisplayName: z
          .object({
            text: z.string(),
          })
          .optional(),
      })
    )
    .optional(),
  nextPageToken: z.string().optional(),
});
