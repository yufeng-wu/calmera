# Liquid Glass forms plan — 2026-10-19

## Scope and ownership

Retain the current warm Calmera theme, Today/History layout, Clerk login, ChatGPT inference and persistence. Do not touch the physical phone or inspect personal records. Preserve the accepted native summary context menu, including its animation and SF Symbol.

- Integration: shared native glass buttons, native UISlider bridge, stable full-screen navigation, review and simulator verification.
- Goals: live-value sliders with exact numeric input; existing GET/PUT, survey, refresh and errors stay in place.
- Manual: grouped labeled fields, meal selection, clear manual-macro path, consistent navigation and estimate control. Preserve FoodEntryFormCard API for edit screens.
- Photo: selected-image preview, equal camera/library actions, explicit processing stages and existing retry safeguards.

## Visual rules

Use actual UIKit glass controls for navigation and actions on iOS 26. Content and text-entry surfaces remain quiet, readable grouped cards. Keep materials at full ancestor opacity. Respect Dynamic Type, Reduce Transparency and accessible labels. Keep minimum 44pt hit targets. Avoid new libraries or decorative restyling of unrelated screens.

Native sliders have live value feedback and preserve precise input. Bounds are interaction conveniences, not recommended nutrition targets; existing values must not be silently rounded or clamped.

## Transition fix

Keep the destination root and header mounted during profile loading. Use opaque cream navigation backgrounds and explicit full-screen card presentation. Inspect the existing iOS native-stack transition; if it introduces transient rounded masks below the globally inset SafeScreen, use the framework's supported simple_push transition for these custom-header forms. Do not replace or disable the native context menu animation.

## Verification

Build the actual full app for the dedicated Mac simulator once agents finish. Synthetic UI fixtures on the production components must skip account-data fetches, AI calls, photo/camera access and writes. Exercise goal slider/value editing and local Save, manual field/macro states, photo empty/preview/processing states, plus native menu-to-goals navigation. Report any animation that cannot be captured reliably. Return the simulator to the actual app without inspecting personal data.

References: Apple HIG Sliders, Materials, and Adopting Liquid Glass.
- https://developer.apple.com/design/human-interface-guidelines/sliders
- https://developer.apple.com/design/human-interface-guidelines/materials
- https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass


## Current Goals refinement

The latest user decision replaces precise keyboard entry with slider-only controls and read-only integer values. Use compact label/value headings, full-width 44pt native slider regions, reduced vertical gaps, and integer normalization of loaded/survey/draft/save values. Do not modify stored goals until explicit Save.
