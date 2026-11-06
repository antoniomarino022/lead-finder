# LeadFinder

Applicazione web per l'acquisizione di lead B2B da **Google Maps (Places API New)**, l'analisi automatica dei siti web aziendali (estrazione email e rilevamento widget chatbot) e la gestione del flusso di outreach e trattativa.

## Stack Tecnologico

- **Framework:** Next.js 16 (App Router, Turbopack) + React 19
- **Database:** SQLite (Turso / `@libsql/client`)
- **ORM:** Drizzle ORM + Drizzle Kit
- **Validazione:** Zod (`schemas/`)
- **Data Fetching & Stato Server:** TanStack Query (`@tanstack/react-query`)
- **Styling:** Tailwind CSS v4 (Dark Mode minimale)

---

## Funzionalità Principali

1. **Estrazione Lead da Google Maps (`POST /api/leads/search`)**
   - Ricerca attività per `categoria` + `città` con supporto multipagina (fino a 60 risultati per ricerca).
   - Ottimizzazione dei costi tramite `X-Goog-FieldMask` (richiede solo i campi necessari).
   - **Anti-duplicati automatico** tramite vincolo `UNIQUE` su `place_id` (`onConflictDoNothing`).
2. **Analizzatore Siti Web (`lib/website-analyzer.ts`)**
   - Estrae automaticamente indirizzi email (`mailto:` e pattern nel testo HTML).
   - Rileva la presenza di chatbot e identifica il vendor (*Tidio, Intercom, Crisp, Tawk.to, Zendesk, HubSpot, Drift, LiveChat, Smartsupp, Botpress, Voiceflow, Landbot, ManyChat*, ecc.).
3. **CRM & Pipeline Outreach**
   - Filtri rapidi per individuare subito i lead con **Sito Web ma senza Chatbot** o **Senza Sito Web**.
   - Aggiornamento ottimistico istantaneo per stato `Contattato`, stato `Trattativa` (`in_progress`, `closed`, `rejected`) e `Note`.
   - Esportazione in **CSV** (con codifica UTF-8 BOM compatibile con Excel) dei lead filtrati.

---

## Struttura del Progetto

```text
├── app/
│   ├── api/leads/
│   │   ├── route.ts            # GET /api/leads (lista lead)
│   │   ├── [id]/route.ts       # PATCH e DELETE /api/leads/[id]
│   │   └── search/route.ts     # POST /api/leads/search (scraping Maps + analisi siti)
│   ├── globals.css             # Stili globali Tailwind v4
│   ├── layout.tsx              # Root layout con Providers
│   ├── page.tsx                # Dashboard principale
│   └── providers.tsx           # Configurazione QueryClientProvider
├── db/
│   ├── index.ts                # Connessione client LibSQL / Drizzle
│   └── schema.ts               # Tabella SQLite `leads`
├── lib/
│   ├── google-places.ts        # Client Google Places API (New)
│   └── website-analyzer.ts     # Scraper email e detector chatbot
├── schemas/
│   └── index.ts                # Schemi di validazione Zod
└── types/
    └── index.ts                # Tipi e interfacce TypeScript
```

---

## Configurazione

### 1. Variabili d'ambiente (`.env`)

Crea un file `.env` nella root del progetto:

```env
TURSO_DATABASE_URL="libsql://tuo-db.turso.io"
TURSO_AUTH_TOKEN="tuo-token-turso"
GOOGLE_PLACES_API_KEY="tua-api-key-google-places-new"
```

### 2. Installazione e Database

```bash
# Installa le dipendenze
npm install

# Sincronizza lo schema Drizzle sul database Turso
npm run db:push
```

### 3. Avvio in sviluppo

```bash
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000) nel browser.

---

## Script Disponibili

- `npm run dev` — Avvia il server di sviluppo Next.js
- `npm run build` — Esegue la build di produzione
- `npm run db:generate` — Genera i file di migrazione SQL in `drizzle/`
- `npm run db:push` — Applica lo schema direttamente al database
- `npm run db:studio` — Avvia Drizzle Studio per esplorare il database
