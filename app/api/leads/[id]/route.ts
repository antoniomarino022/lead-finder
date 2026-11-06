import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { updateLeadSchema } from "@/schemas";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const leadId = Number(id);

    if (!Number.isInteger(leadId) || leadId <= 0) {
      return NextResponse.json({ error: "ID lead non valido" }, { status: 400 });
    }

    const rawBody = await request.json();
    const parsed = updateLeadSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dati non validi",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const updated = await db
      .update(leads)
      .set(parsed.data)
      .where(eq(leads.id, leadId))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });
    }

    return NextResponse.json({ lead: updated[0] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Errore durante l'aggiornamento";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const leadId = Number(id);

    if (!Number.isInteger(leadId) || leadId <= 0) {
      return NextResponse.json({ error: "ID lead non valido" }, { status: 400 });
    }

    const deleted = await db
      .delete(leads)
      .where(eq(leads.id, leadId))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Lead non trovato" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Errore durante l'eliminazione";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
