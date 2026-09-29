// Colours available for job types. A validated categorical palette: the hues stay distinguishable
// for colour-blind viewers, and a few are light on white, so a type's name is always shown with it.
export const TYPE_COLORS = [
  { id: "blue", label: "Blue", hex: "#2a78d6" },
  { id: "orange", label: "Orange", hex: "#eb6834" },
  { id: "aqua", label: "Aqua", hex: "#1baf7a" },
  { id: "yellow", label: "Yellow", hex: "#eda100" },
  { id: "pink", label: "Pink", hex: "#e87ba4" },
  { id: "green", label: "Green", hex: "#008300" },
  { id: "violet", label: "Violet", hex: "#4a3aa7" },
  { id: "red", label: "Red", hex: "#e34948" },
] as const;

export type TypeColor = (typeof TYPE_COLORS)[number]["id"];

export function isTypeColor(value: unknown): value is TypeColor {
  return TYPE_COLORS.some((c) => c.id === value);
}

export function colorHex(id: string): string {
  return TYPE_COLORS.find((c) => c.id === id)?.hex ?? "#94a3b8";
}

export type JobType = { id: number; name: string; color: TypeColor; position: number };
