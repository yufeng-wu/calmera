// Scale derived from the user-tuned Today / History / Settings typography.
// Values are base iOS points; React Native and UIKit keep system text scaling.
export const TYPOGRAPHY = Object.freeze({
  brand: { fontSize: 22, fontWeight: "600", lineHeight: 28, letterSpacing: -0.4 },
  authTitle: { fontSize: 22, fontWeight: "600", lineHeight: 28 },
  pageTitle: { fontSize: 18, fontWeight: "600", lineHeight: 24 },
  sectionTitle: { fontSize: 16, fontWeight: "600", lineHeight: 22 },
  body: { fontSize: 14, fontWeight: "400", lineHeight: 20 },
  bodyMedium: { fontSize: 14, fontWeight: "500", lineHeight: 20 },
  button: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: "400", lineHeight: 18 },
  captionMedium: { fontSize: 12, fontWeight: "500", lineHeight: 18 },
  eyebrow: { fontSize: 12, fontWeight: "600", lineHeight: 18, letterSpacing: 0.8 },
  input: { fontSize: 16, fontWeight: "400", lineHeight: 22 },
  value: { fontSize: 18, fontWeight: "600", lineHeight: 24, fontVariant: ["tabular-nums"] },
  code: { fontSize: 22, fontWeight: "600", lineHeight: 28, letterSpacing: 4 },
});
