import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { leads } from "@/db/schema";

export async function GET() {
  try {
    const allLeads = await db
      .select()
      .from(leads)
      .orderBy(desc(leads.createdAt), desc(leads.id));

    return NextResponse.json({ leads: allLeads });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Errore nel caricamento dei lead";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
