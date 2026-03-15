import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ysbgfiqsuvdwzkcsiqir.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzYmdmaXFzdXZkd3prY3NpcWlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MDMxODEsImV4cCI6MjA4OTA3OTE4MX0.eZInj2uw44jmI6OnWz9fll301x5eBq_1LSQTbMyJtj4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
