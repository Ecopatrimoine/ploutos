import { PLACEMENT_FAMILIES, FAMILY_COLORS, PLACEMENT_TYPES_BY_FAMILY, labelPlacement } from "../constants";
import { AssetPickerModal, type AssetPickerGroup } from "./AssetPickerModal";

// Version « placements » de la fenêtre générique : construit les groupes depuis
// les familles de placements (libellés d'affichage via labelPlacement). Rendu
// strictement identique à la version validée — aucune logique par nature ici.
interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (type: string) => void;
}

export function PlacementPickerModal({ open, onClose, onPick }: Props) {
  const groups: AssetPickerGroup[] = PLACEMENT_FAMILIES.map((fam) => ({
    label: fam.label,
    color: FAMILY_COLORS[fam.value],
    items: (PLACEMENT_TYPES_BY_FAMILY[fam.value] || []).map((type) => ({ value: type, label: labelPlacement(type) })),
  }));
  return <AssetPickerModal open={open} title="Ajouter un placement" groups={groups} onClose={onClose} onPick={onPick} />;
}
