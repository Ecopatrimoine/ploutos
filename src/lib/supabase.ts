import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = (import.meta as any).env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Variables d'environnement Supabase manquantes — vérifiez votre fichier .env");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Base des Edge Functions, dérivée de l'URL projet (source unique). Fallback sur
// la ref historique pour ne jamais casser un build sans .env complet.
export const SUPABASE_FUNCTIONS_URL =
  `${SUPABASE_URL || "https://ysbgfiqsuvdwzkcsiqir.supabase.co"}/functions/v1`;