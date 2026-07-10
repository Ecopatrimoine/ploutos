// LOT 10e (C-ADRESSE) — autocomplétion d'adresse via la Base Adresse Nationale
// (service public, sans compte, aucune donnée stockée côté API). fetch natif, ZÉRO
// dépendance npm. JAMAIS bloquant : saisie manuelle toujours possible ; échec/timeout
// réseau = dégradation silencieuse en champ texte simple (aucun message d'erreur).
// Vie privée : seule la chaîne d'adresse est envoyée, jamais de nom.

import React from "react";
import { Input } from "@/components/ui/input";
import { BRAND, SURFACE } from "../../constants";

const BAN_URL = "https://api-adresse.data.gouv.fr/search/";

export type AdresseSuggestion = { label: string; name: string; postcode: string; city: string };

// Extraction defensive des proprietes BAN (feature.properties).
function toSuggestions(json: unknown): AdresseSuggestion[] {
  const feats = (json as { features?: unknown })?.features;
  if (!Array.isArray(feats)) return [];
  return feats
    .map((f) => {
      const p = (f as { properties?: Record<string, unknown> })?.properties ?? {};
      const label = typeof p.label === "string" ? p.label : "";
      return {
        label,
        name: typeof p.name === "string" ? p.name : label,
        postcode: typeof p.postcode === "string" ? p.postcode : "",
        city: typeof p.city === "string" ? p.city : "",
      };
    })
    .filter((s) => s.label.length > 0);
}

export function AdresseAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (a: { adresse: string; codePostal: string; ville: string }) => void;
  placeholder?: string;
  className?: string;
}) {
  const [suggestions, setSuggestions] = React.useState<AdresseSuggestion[]>([]);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const timer = React.useRef<number | null>(null);
  const abort = React.useRef<AbortController | null>(null);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const listId = React.useId();

  const runFetch = React.useCallback((q: string) => {
    if (abort.current) abort.current.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    const to = window.setTimeout(() => ctrl.abort(), 2000); // timeout reseau ~2s
    // Vie privee : on n'envoie QUE la chaine d'adresse (jamais de nom).
    fetch(`${BAN_URL}?q=${encodeURIComponent(q)}&limit=5`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("http"))))
      .then((j) => {
        window.clearTimeout(to);
        const s = toSuggestions(j);
        setSuggestions(s);
        setOpen(s.length > 0);
        setActive(-1);
      })
      .catch(() => {
        // Degradation SILENCIEUSE : pas de message, la saisie manuelle reste intacte.
        window.clearTimeout(to);
        setSuggestions([]);
        setOpen(false);
      });
  }, []);

  const handleChange = (v: string) => {
    onChange(v);
    if (timer.current) window.clearTimeout(timer.current);
    if (v.trim().length >= 4) {
      timer.current = window.setTimeout(() => runFetch(v.trim()), 300); // debounce 300ms
    } else {
      setSuggestions([]);
      setOpen(false);
    }
  };

  const choose = (s: AdresseSuggestion) => {
    // Remplit adresse + code postal + ville en une fois (champs restent editables).
    onSelect({ adresse: s.name, codePostal: s.postcode, ville: s.city });
    setOpen(false);
    setSuggestions([]);
    setActive(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); choose(suggestions[active]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  React.useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="relative" ref={boxRef}>
      <Input
        value={value || ""}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={className}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-opt-${active}` : undefined}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Suggestions d'adresse"
          className="absolute z-50 mt-1 w-full rounded-xl"
          style={{ background: "#fff", border: `1px solid ${SURFACE.border}`, maxHeight: 240, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}
        >
          {suggestions.map((s, i) => (
            <li
              key={i}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); choose(s); }}
              className="px-3 py-2 text-sm cursor-pointer"
              style={{ background: i === active ? "rgba(81,106,199,0.1)" : "transparent", color: BRAND.navy }}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
