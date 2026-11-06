import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const leads = sqliteTable("leads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  placeId: text("place_id").notNull().unique(), // anti-duplicati
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  category: text("category"),
  city: text("city"),
  websiteUrl: text("website_url"),
  hasWebsite: integer("has_website", { mode: "boolean" }).notNull().default(false),
  hasChatbot: integer("has_chatbot", { mode: "boolean" }), // null = non analizzato
  chatbotVendor: text("chatbot_vendor"),
  contacted: integer("contacted", { mode: "boolean" }).notNull().default(false),
  negotiation: text("negotiation", {
    enum: ["in_progress", "closed", "rejected"],
  }), // null = non in trattativa
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

