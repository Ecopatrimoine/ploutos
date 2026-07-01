import * as React from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";
import { parseDateFr, formatIsoVersFr } from "@/lib/dates/dateFr";

// Champ de saisie de date masque JJ/MM/AAAA, DROP-IN du pattern <Input type="date">.
// Independant de la locale du navigateur (contrairement au date-picker natif qui
// affiche MM/JJ/AAAA sous Windows/Electron en anglais). Le stockage reste l'ISO
// "yyyy-mm-dd" : `value` et `onChange` parlent ISO, comme aujourd'hui.
export type DateFrProps = {
  /** Valeur stockee, au format ISO "yyyy-mm-dd" (ou "" si non renseignee). */
  value: string;
  /** Emis avec l'ISO "yyyy-mm-dd" quand la date est complete et valide, ou "" si vide. */
  onChange: (isoOuVide: string) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  placeholder?: string;
};

/** Masque JJ/MM/AAAA : garde <= 8 chiffres, insere "/" apres le jour et le mois. */
function masque(saisie: string): string {
  const d = saisie.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** Normalise une saisie/collage vers l'affichage FR. Un collage ISO complet
 *  (yyyy-mm-dd) est converti ; sinon on masque les chiffres (gere 8 chiffres colles). */
function normaliserEntree(brut: string): string {
  const s = brut.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const fr = formatIsoVersFr(s);
    if (fr) return fr;
  }
  return masque(s);
}

export function DateFr({ value, onChange, disabled, id, className, placeholder = "JJ/MM/AAAA" }: DateFrProps) {
  const [texte, setTexte] = React.useState<string>(() => formatIsoVersFr(value));

  // Resynchronise l'affichage quand la `value` ISO externe change et ne correspond
  // plus au texte courant (chargement dossier, reset). On ne resynchronise PAS
  // pendant une frappe incomplete (value inchangee tant qu'on n'a rien emis), ce
  // qui evite d'ecraser la saisie en cours.
  React.useEffect(() => {
    const isoCourant = parseDateFr(texte) ?? "";
    if (value !== isoCourant) {
      setTexte(formatIsoVersFr(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nouveauTexte = normaliserEntree(e.target.value);
    setTexte(nouveauTexte);
    if (nouveauTexte === "") {
      onChange(""); // champ vide -> reinitialise la valeur stockee
      return;
    }
    const iso = parseDateFr(nouveauTexte);
    if (iso) onChange(iso); // date complete et valide -> emet l'ISO
    // sinon incomplet/invalide : ne PAS emettre (ne pas ecraser la valeur precedente)
  };

  const enErreur = texte.length > 0 && parseDateFr(texte) === null;

  return (
    <Input
      type="text"
      inputMode="numeric"
      maxLength={10}
      id={id}
      disabled={disabled}
      placeholder={placeholder}
      value={texte}
      onChange={handleChange}
      aria-invalid={enErreur || undefined}
      className={cn(className, enErreur && "border-red-400 focus-visible:border-red-500")}
    />
  );
}
