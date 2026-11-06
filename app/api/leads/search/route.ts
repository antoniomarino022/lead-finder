import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { searchGooglePlaces } from "@/lib/google-places";
import { analyzeWebsite } from "@/lib/website-analyzer";
import { searchLeadsSchema } from "@/schemas";
import type { NewLead } from "@/types";

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsed = searchLeadsSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dati di input non validi",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { category, city, maxPages, analyzeWebsites } = parsed.data;

    // 1. Cerca i luoghi su Google Places API (New)
    const places = await searchGooglePlaces(category, city, maxPages);

    if (places.length === 0) {
      return NextResponse.json({
        found: 0,
        inserted: 0,
        leads: [],
      });
    }

    // 2. Opzionale: analizza i siti web in parallelo per estrarre email e chatbot
    const newLeads: NewLead[] = await Promise.all(
      places.map(async (place) => {
        if (analyzeWebsites && place.websiteUrl) {
          const analysis = await analyzeWebsite(place.websiteUrl);
          return {
            ...place,
            email: analysis.email,
            hasChatbot: analysis.hasChatbot,
            chatbotVendor: analysis.chatbotVendor,
          };
        }

        return {
          ...place,
          email: null,
          hasChatbot: null,
          chatbotVendor: null,
        };
      })
    );

    // 3. Salva su Turso ignorando i duplicati su place_id
    const insertedLeads = await db
      .insert(leads)
      .values(newLeads)
      .onConflictDoNothing({ target: leads.placeId })
      .returning();

    return NextResponse.json({
      found: places.length,
      inserted: insertedLeads.length,
      skippedDuplicates: places.length - insertedLeads.length,
      leads: insertedLeads,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Errore interno del server";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
