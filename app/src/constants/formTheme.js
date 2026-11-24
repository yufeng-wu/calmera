import { COLORS } from "@/constants/colors";

// Keep the app palette; small form labels need stronger text contrast.
// track is the quiet fill behind data and controls; soft is the accent's lighter step,
// for data that's still partial or being compared against.
export const FORM_COLORS = { ...COLORS, textLight: "#78685E", expense: "#C12D26", track: "#EFE7E0", soft: "#E4BFA5" };
