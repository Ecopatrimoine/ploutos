import { describe, it, expect } from "vitest";
import {
  foldText,
  formatBirthDateFr,
  departementFrom,
  situationLabel,
  hasPerson2,
  dossierName,
  dossierMeta,
  dossierResume,
  formatRelativeDate,
  anyCriteria,
  draftDossierName,
  matchesCriteria,
  EMPTY_CRITERIA,
  type DossierData,
  type SearchCriteria,
} from "../lib/accueil/dossierResume";

const crit = (c: Partial<SearchCriteria>): SearchCriteria => ({ ...EMPTY_CRITERIA, ...c });

describe("foldText — accents + casse", () => {
  it("supprime les diacritiques et abaisse la casse", () => {
    expect(foldText("Hélène")).toBe("helene");
    expect(foldText("Éléonore")).toBe("eleonore");
    expect(foldText("García")).toBe("garcia");
    expect(foldText("Thành")).toBe("thanh");
  });
  it("ne mange pas les chiffres (garde-fou du bug de char-class)", () => {
    expect(foldText("2003")).toBe("2003");
    expect(foldText("66000")).toBe("66000");
  });
  it("tolère null/undefined", () => {
    expect(foldText(undefined)).toBe("");
    expect(foldText(null)).toBe("");
  });
});

describe("formatBirthDateFr — ISO -> jj/mm/aaaa", () => {
  it("convertit une date ISO", () => {
    expect(formatBirthDateFr("1978-11-03")).toBe("03/11/1978");
    expect(formatBirthDateFr("1978-11-03T00:00:00.000Z")).toBe("03/11/1978");
  });
  it("renvoie vide sur format inattendu ou vide", () => {
    expect(formatBirthDateFr("")).toBe("");
    expect(formatBirthDateFr(undefined)).toBe("");
    expect(formatBirthDateFr("03/11/1978")).toBe("");
  });
});

describe("departementFrom — 2 premiers chiffres du CP", () => {
  it("extrait le département", () => {
    expect(departementFrom("66000")).toBe("66");
    expect(departementFrom("09000")).toBe("09");
  });
  it("vide si CP absent ou trop court", () => {
    expect(departementFrom("")).toBe("");
    expect(departementFrom("6")).toBe("");
    expect(departementFrom(undefined)).toBe("");
  });
});

describe("situationLabel — vocabulaire maquette", () => {
  it("mappe les statuts connus", () => {
    expect(situationLabel("married")).toBe("Couple marié");
    expect(situationLabel("pacs")).toBe("Couple pacsé");
    expect(situationLabel("cohab")).toBe("Concubinage");
    expect(situationLabel("single")).toBe("Célibataire");
    expect(situationLabel("divorced")).toBe("Divorcé");
  });
  it("vide sur statut inconnu/absent", () => {
    expect(situationLabel("")).toBe("");
    expect(situationLabel("veuf")).toBe("");
  });
});

describe("dossierName — Nom, Prénom(s)", () => {
  it("couple : joint les deux prénoms", () => {
    const d: DossierData = {
      person1LastName: "Martin",
      person1FirstName: "Sophie",
      person2FirstName: "Julien",
      coupleStatus: "married",
    };
    expect(dossierName(d, "fallback")).toBe("Martin, Sophie & Julien");
  });
  it("célibataire : un seul prénom", () => {
    const d: DossierData = {
      person1LastName: "Delacroix",
      person1FirstName: "Hélène",
      coupleStatus: "single",
    };
    expect(dossierName(d, "fallback")).toBe("Delacroix, Hélène");
  });
  it("ne joint pas la personne 2 hors statut de couple", () => {
    const d: DossierData = {
      person1LastName: "García",
      person1FirstName: "José",
      person2FirstName: "Ana",
      coupleStatus: "divorced",
    };
    expect(dossierName(d, "fallback")).toBe("García, José");
  });
  it("repli sur le nom de dossier si aucune identité", () => {
    expect(dossierName({}, "Dossier test")).toBe("Dossier test");
    expect(dossierName({ person1FirstName: "  " }, "Dossier test")).toBe("Dossier test");
  });
  it("nom seul ou prénom seul", () => {
    expect(dossierName({ person1LastName: "Nguyen" }, "x")).toBe("Nguyen");
    expect(dossierName({ person1FirstName: "Thành" }, "x")).toBe("Thành");
  });
});

describe("dossierMeta — Né(e) le … · Ville (dept)", () => {
  it("compose les deux morceaux", () => {
    const d: DossierData = { person1BirthDate: "1981-05-14", ville: "Perpignan", codePostal: "66000" };
    expect(dossierMeta(d)).toBe("Né(e) le 14/05/1981 · Perpignan (66)");
  });
  it("masque la date absente", () => {
    expect(dossierMeta({ ville: "Canet", codePostal: "66140" })).toBe("Canet (66)");
  });
  it("ville sans CP", () => {
    expect(dossierMeta({ ville: "Foix" })).toBe("Foix");
  });
  it("CP sans ville -> département seul", () => {
    expect(dossierMeta({ codePostal: "31000" })).toBe("31");
  });
  it("tout absent -> vide", () => {
    expect(dossierMeta({})).toBe("");
  });
});

describe("dossierResume — situation · enfants · biens · placements", () => {
  it("couple avec enfants, biens, placements", () => {
    const d: DossierData = {
      coupleStatus: "married",
      childrenData: [{}, {}] as any,
      properties: [{}, {}, {}, {}] as any,
      placements: [{}, {}, {}, {}, {}, {}] as any,
    };
    expect(dossierResume(d)).toBe("Couple marié · 2 enfants · 4 biens · 6 placements");
  });
  it("0 enfant -> sans enfant, singuliers corrects", () => {
    const d: DossierData = {
      coupleStatus: "pacs",
      childrenData: [] as any,
      properties: [{}] as any,
      placements: [{}] as any,
    };
    expect(dossierResume(d)).toBe("Couple pacsé · sans enfant · 1 bien · 1 placement");
  });
  it("dossier totalement vierge -> vide", () => {
    expect(dossierResume({})).toBe("");
    expect(dossierResume({ childrenData: [] as any, properties: [] as any, placements: [] as any })).toBe("");
  });
});

describe("formatRelativeDate", () => {
  const now = new Date("2026-07-08T12:00:00").getTime();
  it("aujourd'hui", () => {
    expect(formatRelativeDate("2026-07-08T09:12:00", now)).toBe("Aujourd'hui · 09:12");
  });
  it("hier", () => {
    expect(formatRelativeDate("2026-07-07T18:47:00", now)).toBe("Hier · 18:47");
  });
  it("même année -> jj/mm", () => {
    expect(formatRelativeDate("2026-07-06T16:03:00", now)).toBe("06/07 · 16:03");
  });
  it("année différente -> jj/mm/aaaa", () => {
    expect(formatRelativeDate("2025-06-12T17:22:00", now)).toBe("12/06/2025 · 17:22");
  });
  it("date invalide -> vide", () => {
    expect(formatRelativeDate("", now)).toBe("");
  });
});

describe("criteria helpers", () => {
  it("anyCriteria", () => {
    expect(anyCriteria(EMPTY_CRITERIA)).toBe(false);
    expect(anyCriteria(crit({ nom: "x" }))).toBe(true);
    expect(anyCriteria(crit({ dept: " " }))).toBe(false);
  });
  it("draftDossierName pré-alimente depuis Nom/Prénom", () => {
    expect(draftDossierName(crit({ nom: "Delacroix", prenom: "Hélène" }))).toBe("Delacroix Hélène");
    expect(draftDossierName(crit({ nom: "Nguyen" }))).toBe("Nguyen");
    expect(draftDossierName(EMPTY_CRITERIA)).toBe("Nouveau dossier");
  });
});

describe("matchesCriteria — cumulatif, accents, personne 1 ET 2", () => {
  const couple: DossierData = {
    person1LastName: "Ferreira",
    person1FirstName: "Miguel",
    person1BirthDate: "1990-03-22",
    person2LastName: "Ferreira",
    person2FirstName: "Ana",
    person2BirthDate: "1992-01-30",
    coupleStatus: "pacs",
    ville: "Narbonne",
    codePostal: "11100",
  };

  it("nom insensible aux accents/casse", () => {
    expect(matchesCriteria({ person1LastName: "García" }, crit({ nom: "garcia" }))).toBe(true);
    expect(matchesCriteria({ person1LastName: "García" }, crit({ nom: "GARC" }))).toBe(true);
  });
  it("prénom sur personne 2", () => {
    expect(matchesCriteria(couple, crit({ prenom: "ana" }))).toBe(true);
    expect(matchesCriteria(couple, crit({ prenom: "zoe" }))).toBe(false);
  });
  it("date de naissance partielle (espaces ignorés)", () => {
    expect(matchesCriteria(couple, crit({ naiss: "1990" }))).toBe(true);
    expect(matchesCriteria(couple, crit({ naiss: "03/1990" }))).toBe(true);
    expect(matchesCriteria(couple, crit({ naiss: "22/03" }))).toBe(true);
    expect(matchesCriteria(couple, crit({ naiss: "30/01/1992" }))).toBe(true); // personne 2
    expect(matchesCriteria(couple, crit({ naiss: "1999" }))).toBe(false);
  });
  it("département par préfixe de CP", () => {
    expect(matchesCriteria(couple, crit({ dept: "11" }))).toBe(true);
    expect(matchesCriteria(couple, crit({ dept: "66" }))).toBe(false);
  });
  it("département par nom de ville (accents ignorés)", () => {
    expect(matchesCriteria(couple, crit({ dept: "narbonne" }))).toBe(true);
    expect(matchesCriteria({ ville: "Céret", codePostal: "66400" }, crit({ dept: "ceret" }))).toBe(true);
  });
  it("cumulatif (ET) : tous les critères doivent passer", () => {
    expect(matchesCriteria(couple, crit({ nom: "ferreira", prenom: "miguel" }))).toBe(true);
    expect(matchesCriteria(couple, crit({ nom: "ferreira", prenom: "zoe" }))).toBe(false);
  });
  it("aucun critère -> vrai", () => {
    expect(matchesCriteria(couple, EMPTY_CRITERIA)).toBe(true);
  });
  it("hasPerson2", () => {
    expect(hasPerson2(couple)).toBe(true);
    expect(hasPerson2({ person1FirstName: "Seul" })).toBe(false);
  });
});
