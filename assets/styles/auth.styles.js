import { TYPOGRAPHY } from "@/constants/typography";
import { StyleSheet } from "react-native";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  column: { width: "100%", maxWidth: 520, alignSelf: "center", gap: 16 },
  wordmark: { ...TYPOGRAPHY.brand, color: COLORS.primary, textAlign: "center", paddingVertical: 12},
  hero: { paddingHorizontal: 4, paddingTop: 0, gap: 8 },
  title: { ...TYPOGRAPHY.authTitle, color: COLORS.text},
  subtitle: { ...TYPOGRAPHY.body, color: COLORS.textLight},
  form: { gap: 16 },
  field: { gap: 8 },
  label: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text},
  input: { ...TYPOGRAPHY.input, minHeight: 52, backgroundColor: COLORS.card, borderRadius: 16, paddingHorizontal: 15,
    paddingVertical: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
    color: COLORS.text},
  codeInput: { ...TYPOGRAPHY.code, textAlign: "center"},
  errorInput: { borderColor: COLORS.expense },
  hint: { ...TYPOGRAPHY.caption, color: COLORS.textLight,},
  action: { minHeight: 52, width: "100%" },
  trailingLink: { alignSelf: "flex-end", marginTop: -8 },
  link: { minHeight: 44, justifyContent: "center", paddingVertical: 10, paddingHorizontal: 4 },
  linkText: { ...TYPOGRAPHY.button, color: COLORS.primary,},
  footer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", columnGap: 6 },
  footerText: { ...TYPOGRAPHY.body, color: COLORS.textLight, textAlign: "center"},
  notice: { padding: 14, borderRadius: 16, backgroundColor: "#F5ECE3", flexDirection: "row", gap: 10, alignItems: "flex-start" },
  errorNotice: { backgroundColor: "#FBECE7" },
  noticeText: { ...TYPOGRAPHY.body, flex: 1, color: COLORS.text,},
  busy: { flexDirection: "row", alignItems: "center", gap: 12 },
});
