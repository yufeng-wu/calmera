import { FORM_COLORS } from "@/constants/formTheme";

// The design system for the Settings tab and every page it opens: white cards on the
// theme canvas, warm hairlines, and pastel icon tiles drawn from the nutrient ring colors.
export const SETTINGS = Object.freeze({
  ink: FORM_COLORS.text,
  inkSoft: FORM_COLORS.textLight,
  accent: FORM_COLORS.primary,
  danger: FORM_COLORS.expense,
  surface: "#FFFFFF",
  edge: "#EDE3DA",
  hairline: "#EFE6DE",
  // A row's touch highlight: plainly visible on white, then fades out on release.
  pressed: "#EFE3D8",
  chevron: "#C4B5AA",
  gutter: 20,
  sectionGap: 24,
  cardRadius: 24,
  rowHeight: 56,
  rowPadding: 16,
  rowGap: 12,
  tile: 30,
  tileRadius: 9,
});

// The AI connection pages (and the Model, Usage and key pages they open) as the owner set them:
// a solid peach page and off-white cards, over whichever theme canvas is chosen. faint is the
// quietest text, for the OPTION labels and OR.
export const AI_PAGE = Object.freeze({ page: "#FFF4EA", card: "#FFFBF9", faint: "#9A8478" });

// A pale fill with a darker icon on top, dark enough to read on its fill.
export const TINTS = Object.freeze({
  tangerine: { fill: "#FDEBDD", icon: "#BC5A19" },
  leaf: { fill: "#E8F2E3", icon: "#4C8648" },
  sky: { fill: "#E6EDFD", icon: "#4467D6" },
  plum: { fill: "#F3E6F0", icon: "#8E4A82" },
  rose: { fill: "#FBE7E9", icon: "#B94A58" },
  cocoa: { fill: "#F2ECE7", icon: "#2B211C" },
});

// The checkmark pops in; values that arrive late fade in.
export const SETTINGS_MOTION = Object.freeze({
  pop: { damping: 14, stiffness: 320, mass: 0.6 },
  popFrom: 0.6,
  fade: 180, release: 260,
});
