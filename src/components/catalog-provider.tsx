"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Catalog, CatalogSeed } from "@/lib/catalog-types";
import { mockCatalog, seedToCatalog, withSessionUser } from "@/lib/catalog-build";
import { registerGenres } from "@/lib/genre-helpers";
import { useSession } from "@/store/session";

const CatalogContext = createContext<Catalog | null>(null);

/**
 * Hands every client component the site's data (series, teams, genres, ...) —
 * the real catalogue when the database has one, otherwise the built-in sample
 * data. Replaces the `getMockDatabase()` singleton pages used to call, with the
 * same shape, so a page reads `db.series`, `db.teams`, ... exactly as before.
 */
export function CatalogProvider({ seed, children }: { seed: CatalogSeed | null; children: ReactNode }) {
  const sessionUser = useSession((s) => s.user);
  const base = useMemo(() => (seed ? seedToCatalog(seed) : mockCatalog()), [seed]);
  // Genre chips label themselves from a shared table (see genre-helpers); keep it in step with this catalogue.
  registerGenres(base.genres);
  const value = useMemo(() => withSessionUser(base, sessionUser), [base, sessionUser]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): Catalog {
  const catalog = useContext(CatalogContext);
  if (!catalog) throw new Error("useCatalog must be used inside <CatalogProvider>");
  return catalog;
}
