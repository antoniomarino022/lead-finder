"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { Lead, NegotiationStatus, SearchLeadsRequest, UpdateLeadRequest } from "@/types";

export default function HomePage() {
  const queryClient = useQueryClient();

  // Search form state
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [maxPages, setMaxPages] = useState(1);
  const [analyzeWebsites, setAnalyzeWebsites] = useState(true);
  const [searchFeedback, setSearchFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Filters state
  const [queryFilter, setQueryFilter] = useState("");
  const [targetFilter, setTargetFilter] = useState<
    "all" | "hot_no_chatbot" | "no_website" | "has_chatbot"
  >("all");
  const [contactedFilter, setContactedFilter] = useState<
    "all" | "not_contacted" | "contacted"
  >("all");
  const [negotiationFilter, setNegotiationFilter] = useState<
    "all" | "none" | "in_progress" | "closed" | "rejected"
  >("all");

  // Query: Fetch all leads
  const { data: leads = [], isLoading: loadingLeads } = useQuery<Lead[]>({
    queryKey: ["leads"],
    queryFn: async () => {
      const res = await fetch("/api/leads");
      if (!res.ok) throw new Error("Errore nel caricamento dei lead");
      const data = await res.json();
      return data.leads ?? [];
    },
  });

  // Mutation: Search Google Maps & insert new leads
  const searchMutation = useMutation({
    mutationFn: async (payload: SearchLeadsRequest) => {
      const res = await fetch("/api/leads/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Errore durante la ricerca");
      }
      return data as {
        found: number;
        inserted: number;
        skippedDuplicates?: number;
        leads: Lead[];
      };
    },
    onSuccess: (data) => {
      setSearchFeedback({
        type: "success",
        message: `${data.inserted} nuovi lead aggiunti su ${data.found} trovati (${data.skippedDuplicates ?? 0} duplicati esclusi).`,
      });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (err: Error) => {
      setSearchFeedback({
        type: "error",
        message: err.message || "Errore di connessione con il server.",
      });
    },
  });

  // Mutation: Update a lead (optimistic update)
  const updateLeadMutation = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: number;
      patch: UpdateLeadRequest;
    }) => {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Errore aggiornamento lead");
      return res.json();
    },
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: ["leads"] });
      const previousLeads = queryClient.getQueryData<Lead[]>(["leads"]);

      queryClient.setQueryData<Lead[]>(["leads"], (old = []) =>
        old.map((lead) => (lead.id === id ? { ...lead, ...patch } : lead))
      );

      return { previousLeads };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousLeads) {
        queryClient.setQueryData(["leads"], context.previousLeads);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  // Mutation: Delete a lead (optimistic update)
  const deleteLeadMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Errore eliminazione lead");
      return res.json();
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["leads"] });
      const previousLeads = queryClient.getQueryData<Lead[]>(["leads"]);

      queryClient.setQueryData<Lead[]>(["leads"], (old = []) =>
        old.filter((lead) => lead.id !== id)
      );

      return { previousLeads };
    },
    onError: (_err, _id, context) => {
      if (context?.previousLeads) {
        queryClient.setQueryData(["leads"], context.previousLeads);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchFeedback(null);
    searchMutation.mutate({
      category,
      city,
      maxPages,
      analyzeWebsites,
    });
  }

  function updateLead(id: number, patch: UpdateLeadRequest) {
    updateLeadMutation.mutate({ id, patch });
  }

  function deleteLead(id: number) {
    deleteLeadMutation.mutate(id);
  }

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (queryFilter.trim()) {
        const q = queryFilter.toLowerCase();
        const matchesText =
          lead.name.toLowerCase().includes(q) ||
          (lead.city?.toLowerCase().includes(q) ?? false) ||
          (lead.category?.toLowerCase().includes(q) ?? false) ||
          (lead.email?.toLowerCase().includes(q) ?? false) ||
          (lead.phone?.toLowerCase().includes(q) ?? false);
        if (!matchesText) return false;
      }

      if (targetFilter === "hot_no_chatbot") {
        if (!lead.hasWebsite || lead.hasChatbot !== false) return false;
      } else if (targetFilter === "no_website") {
        if (lead.hasWebsite) return false;
      } else if (targetFilter === "has_chatbot") {
        if (!lead.hasChatbot) return false;
      }

      if (contactedFilter === "contacted" && !lead.contacted) return false;
      if (contactedFilter === "not_contacted" && lead.contacted) return false;

      if (negotiationFilter === "none" && lead.negotiation !== null)
        return false;
      if (
        negotiationFilter !== "all" &&
        negotiationFilter !== "none" &&
        lead.negotiation !== negotiationFilter
      ) {
        return false;
      }

      return true;
    });
  }, [leads, queryFilter, targetFilter, contactedFilter, negotiationFilter]);

  const stats = useMemo(() => {
    const total = leads.length;
    const hotNoChatbot = leads.filter(
      (l) => l.hasWebsite && l.hasChatbot === false
    ).length;
    const noWebsite = leads.filter((l) => !l.hasWebsite).length;
    const contacted = leads.filter((l) => l.contacted).length;
    const inProgress = leads.filter(
      (l) => l.negotiation === "in_progress"
    ).length;
    const closed = leads.filter((l) => l.negotiation === "closed").length;

    return { total, hotNoChatbot, noWebsite, contacted, inProgress, closed };
  }, [leads]);

  function exportCsv() {
    if (filteredLeads.length === 0) return;
    const headers = [
      "Nome",
      "Categoria",
      "Città",
      "Telefono",
      "Email",
      "Sito Web",
      "Ha Chatbot",
      "Vendor Chatbot",
      "Contattato",
      "Trattativa",
      "Note",
    ];
    const rows = filteredLeads.map((l) => [
      `"${(l.name ?? "").replace(/"/g, '""')}"`,
      `"${(l.category ?? "").replace(/"/g, '""')}"`,
      `"${(l.city ?? "").replace(/"/g, '""')}"`,
      `"${(l.phone ?? "").replace(/"/g, '""')}"`,
      `"${(l.email ?? "").replace(/"/g, '""')}"`,
      `"${(l.websiteUrl ?? "").replace(/"/g, '""')}"`,
      l.hasChatbot === null ? "Non analizzato" : l.hasChatbot ? "Sì" : "No",
      `"${(l.chatbotVendor ?? "").replace(/"/g, '""')}"`,
      l.contacted ? "Sì" : "No",
      `"${l.negotiation ?? ""}"`,
      `"${(l.notes ?? "").replace(/"/g, '""')}"`,
    ]);

    const csvString = [headers.join(","), ...rows.map((e) => e.join(","))].join(
      "\r\n"
    );
    const blob = new Blob(["\uFEFF" + csvString], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `leadfinder-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 antialiased selection:bg-zinc-800 selection:text-zinc-100">
      {/* Top Bar */}
      <header className="sticky top-0 z-10 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-xs font-semibold tracking-tight text-zinc-100">
              LF
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-zinc-100">
                LeadFinder
              </h1>
              <p className="text-xs text-zinc-500">
                Outreach & Lead Intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={exportCsv}
              disabled={filteredLeads.length === 0}
              className="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors duration-150 hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Esporta CSV
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
        {/* KPI Grid */}
        <section className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-zinc-800/90 bg-zinc-900/50 p-5">
            <p className="text-xs font-medium text-zinc-400">Lead Totali</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-zinc-100">
              {stats.total}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800/90 bg-zinc-900/50 p-5">
            <p className="text-xs font-medium text-zinc-400">
              Sito senza Chatbot
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-zinc-100">
              {stats.hotNoChatbot}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800/90 bg-zinc-900/50 p-5">
            <p className="text-xs font-medium text-zinc-400">Senza Sito Web</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-zinc-100">
              {stats.noWebsite}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800/90 bg-zinc-900/50 p-5">
            <p className="text-xs font-medium text-zinc-400">Contattati</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-zinc-100">
              {stats.contacted}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800/90 bg-zinc-900/50 p-5">
            <p className="text-xs font-medium text-zinc-400">In Trattativa</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-zinc-100">
              {stats.inProgress}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800/90 bg-zinc-900/50 p-5">
            <p className="text-xs font-medium text-zinc-400">Chiusi</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-zinc-100">
              {stats.closed}
            </p>
          </div>
        </section>

        {/* Search Panel */}
        <section className="rounded-xl border border-zinc-800/90 bg-zinc-900/50 p-6">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                Acquisizione Lead da Google Maps
              </h2>
              <p className="mt-0.5 text-xs text-zinc-400">
                Ricerca attività locali per categoria e città con scansione
                automatica di email e widget chat.
              </p>
            </div>
            {searchFeedback && (
              <p
                className={`text-xs font-medium ${
                  searchFeedback.type === "success"
                    ? "text-zinc-300"
                    : "text-red-400"
                }`}
              >
                {searchFeedback.message}
              </p>
            )}
          </div>

          <form
            onSubmit={handleSearch}
            className="grid gap-4 md:grid-cols-12"
          >
            <div className="md:col-span-4">
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Categoria
              </label>
              <input
                type="text"
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Studio dentistico, Agenzia immobiliare..."
                className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 placeholder-zinc-500 transition-colors duration-150 focus:border-zinc-600 focus:outline-none"
              />
            </div>

            <div className="md:col-span-3">
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Città
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Milano, Roma, Torino..."
                className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 placeholder-zinc-500 transition-colors duration-150 focus:border-zinc-600 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Profondità
              </label>
              <select
                value={maxPages}
                onChange={(e) => setMaxPages(Number(e.target.value))}
                className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-200 transition-colors duration-150 focus:border-zinc-600 focus:outline-none"
              >
                <option value={1}>20 risultati</option>
                <option value={2}>40 risultati</option>
                <option value={3}>60 risultati</option>
              </select>
            </div>

            <div className="flex items-end md:col-span-3">
              <button
                type="submit"
                disabled={searchMutation.isPending}
                className="h-9 w-full cursor-pointer rounded-lg bg-zinc-100 px-4 text-xs font-semibold text-zinc-950 transition-colors duration-150 hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {searchMutation.isPending ? "Scansione in corso..." : "Estrai Lead"}
              </button>
            </div>

            <div className="pt-1 md:col-span-12">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-400 select-none">
                <input
                  type="checkbox"
                  checked={analyzeWebsites}
                  onChange={(e) => setAnalyzeWebsites(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-950 accent-zinc-100"
                />
                Analizza il sito web di ogni risultato per estrarre l&apos;email
                e verificare la presenza di chatbot
              </label>
            </div>
          </form>
        </section>

        {/* Leads Directory */}
        <section className="rounded-xl border border-zinc-800/90 bg-zinc-900/50">
          {/* Toolbar */}
          <div className="flex flex-col gap-4 border-b border-zinc-800/80 p-5 lg:flex-row lg:items-center lg:justify-between">
            {/* Quick Segment Tabs */}
            <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
              <button
                type="button"
                onClick={() => setTargetFilter("all")}
                className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                  targetFilter === "all"
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Tutti ({stats.total})
              </button>
              <button
                type="button"
                onClick={() => setTargetFilter("hot_no_chatbot")}
                className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                  targetFilter === "hot_no_chatbot"
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Sito senza Chatbot ({stats.hotNoChatbot})
              </button>
              <button
                type="button"
                onClick={() => setTargetFilter("no_website")}
                className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                  targetFilter === "no_website"
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Senza Sito ({stats.noWebsite})
              </button>
              <button
                type="button"
                onClick={() => setTargetFilter("has_chatbot")}
                className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                  targetFilter === "has_chatbot"
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Con Chatbot
              </button>
            </div>

            {/* Search & Secondary Filters */}
            <div className="flex flex-wrap items-center gap-2.5">
              <input
                type="text"
                value={queryFilter}
                onChange={(e) => setQueryFilter(e.target.value)}
                placeholder="Filtra per nome, città, email..."
                className="h-8 w-56 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100 placeholder-zinc-500 transition-colors duration-150 focus:border-zinc-600 focus:outline-none"
              />

              <select
                value={contactedFilter}
                onChange={(e) =>
                  setContactedFilter(e.target.value as typeof contactedFilter)
                }
                className="h-8 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 text-xs text-zinc-300 transition-colors duration-150 hover:border-zinc-700 focus:border-zinc-600 focus:outline-none"
              >
                <option value="all">Contatto: Tutti</option>
                <option value="not_contacted">Da contattare</option>
                <option value="contacted">Contattati</option>
              </select>

              <select
                value={negotiationFilter}
                onChange={(e) =>
                  setNegotiationFilter(
                    e.target.value as typeof negotiationFilter
                  )
                }
                className="h-8 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 text-xs text-zinc-300 transition-colors duration-150 hover:border-zinc-700 focus:border-zinc-600 focus:outline-none"
              >
                <option value="all">Trattativa: Tutte</option>
                <option value="none">Nessuna</option>
                <option value="in_progress">In corso</option>
                <option value="closed">Chiuso</option>
                <option value="rejected">Rifiutato</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-zinc-800/80 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-3">Attività</th>
                  <th className="px-4 py-3">Contatti</th>
                  <th className="px-4 py-3">Sito & Chatbot</th>
                  <th className="px-4 py-3">Contattato</th>
                  <th className="px-4 py-3">Trattativa</th>
                  <th className="px-4 py-3">Note</th>
                  <th className="px-5 py-3 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-sm">
                {loadingLeads ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-14 text-center text-xs text-zinc-500"
                    >
                      Caricamento lead...
                    </td>
                  </tr>
                ) : filteredLeads.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-14 text-center text-xs text-zinc-500"
                    >
                      Nessun lead corrisponde ai criteri selezionati.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="group transition-colors duration-150 hover:bg-zinc-900/80"
                    >
                      {/* Attività */}
                      <td className="px-5 py-3.5 align-middle">
                        <p className="font-medium text-zinc-100">
                          {lead.name}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {lead.category || "—"} · {lead.city || "—"}
                        </p>
                      </td>

                      {/* Contatti */}
                      <td className="px-4 py-3.5 align-middle">
                        <div className="space-y-0.5">
                          {lead.phone ? (
                            <a
                              href={`tel:${lead.phone}`}
                              className="block text-xs font-medium tabular-nums text-zinc-200 transition-colors hover:text-white"
                            >
                              {lead.phone}
                            </a>
                          ) : (
                            <span className="block text-xs text-zinc-600">
                              —
                            </span>
                          )}
                          {lead.email ? (
                            <a
                              href={`mailto:${lead.email}`}
                              className="block max-w-[200px] truncate text-xs text-zinc-400 transition-colors hover:text-zinc-200"
                              title={lead.email}
                            >
                              {lead.email}
                            </a>
                          ) : (
                            <span className="block text-xs text-zinc-600">
                              Nessuna email
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Sito & Chatbot */}
                      <td className="px-4 py-3.5 align-middle">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {lead.websiteUrl ? (
                            <a
                              href={lead.websiteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs font-medium text-zinc-300 transition-colors duration-150 hover:border-zinc-700 hover:text-zinc-100"
                            >
                              Sito
                              <svg
                                className="h-3 w-3 text-zinc-500"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M7 17L17 7M17 7H8M17 7V16"
                                />
                              </svg>
                            </a>
                          ) : (
                            <span className="inline-flex items-center rounded-md border border-zinc-800/80 bg-zinc-950/50 px-2.5 py-1 text-xs text-zinc-500">
                              Senza sito
                            </span>
                          )}

                          {lead.hasWebsite && (
                            <>
                              {lead.hasChatbot === true ? (
                                <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-400">
                                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                                  {lead.chatbotVendor || "Chatbot"}
                                </span>
                              ) : lead.hasChatbot === false ? (
                                <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-950">
                                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-950" />
                                  No Chatbot
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-md border border-zinc-800/80 bg-zinc-950/50 px-2.5 py-1 text-xs text-zinc-500">
                                  Non analizzato
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </td>

                      {/* Contattato */}
                      <td className="px-4 py-3.5 align-middle">
                        <button
                          type="button"
                          onClick={() =>
                            updateLead(lead.id, {
                              contacted: !lead.contacted,
                            })
                          }
                          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors duration-150 ${
                            lead.contacted
                              ? "border-zinc-700 bg-zinc-800 text-zinc-100"
                              : "border-zinc-800 bg-zinc-950 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              lead.contacted ? "bg-zinc-100" : "bg-zinc-600"
                            }`}
                          />
                          {lead.contacted ? "Contattato" : "Da contattare"}
                        </button>
                      </td>

                      {/* Trattativa */}
                      <td className="px-4 py-3.5 align-middle">
                        <select
                          value={lead.negotiation ?? ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateLead(lead.id, {
                              negotiation:
                                val === "" ? null : (val as NegotiationStatus),
                            });
                          }}
                          className="h-8 rounded-md border border-zinc-800 bg-zinc-950 px-2.5 text-xs text-zinc-300 transition-colors duration-150 hover:border-zinc-700 focus:border-zinc-600 focus:outline-none"
                        >
                          <option value="">Nessuna</option>
                          <option value="in_progress">In trattativa</option>
                          <option value="closed">Chiuso</option>
                          <option value="rejected">Rifiutato</option>
                        </select>
                      </td>

                      {/* Note */}
                      <td className="px-4 py-3.5 align-middle">
                        <input
                          type="text"
                          defaultValue={lead.notes ?? ""}
                          placeholder="Aggiungi nota..."
                          onBlur={(e) => {
                            const newNotes = e.target.value.trim() || null;
                            if (newNotes !== (lead.notes ?? null)) {
                              updateLead(lead.id, { notes: newNotes });
                            }
                          }}
                          className="h-8 w-44 rounded-md border border-zinc-800 bg-zinc-950 px-2.5 text-xs text-zinc-300 placeholder-zinc-600 transition-colors duration-150 focus:border-zinc-600 focus:outline-none"
                        />
                      </td>

                      {/* Azioni */}
                      <td className="px-5 py-3.5 text-right align-middle">
                        <button
                          type="button"
                          onClick={() => deleteLead(lead.id)}
                          className="cursor-pointer rounded-md border border-transparent px-2 py-1 text-xs text-zinc-500 transition-colors duration-150 hover:border-zinc-800 hover:bg-zinc-950 hover:text-zinc-300"
                        >
                          Elimina
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
