# OpenAI service mark

The Blossom belongs to OpenAI and identifies the ChatGPT connection only. It is not Calmera branding and does not imply sponsorship. OpenAI's brand guidelines and Marks usage terms apply: https://openai.com/brand/ .

Original vector, copied byte-for-byte from OpenAI's own app example:
https://github.com/openai/openai-cookbook/blob/3d3c283b30781a8b9ed5a30b3ea4b587e8507fa7/examples/agents_sdk/deployment_manager/frontend/src/openai-logomark.svg

SHA-256: `a41e8e53b14ef686319ed1529066d6a3391aca77d7f6eaaa9f0783acc717375f`.

The transparent PNGs are 20pt rasterizations at 1x/2x/3x of that complete vector canvas, using its default black currentColor. No cropping, redraw, stretching, recoloring, shadow or glass effect is applied to the mark. Byte-identical PNGs are bundled in the native OpenAIBlossom image set with original rendering intent. Both React Native and UIKit use the same artwork; runtime logo downloads are unnecessary.

## Integration and verification

The 20pt mark replaces only the Settings ChatGPT row, connection heading, and Connect/Reconnect icon. Other AI sparkles, typography, authentication callbacks, loading and disabled behavior remain. UIKit uses the OpenAIBlossom catalog image in original rendering mode, with its image color transformer disabled; React Native uses the matching bundled PNG. The connection heading retains 14pt of whitespace around the mark.

Scoped ESLint, all 60 existing Node tests, Swift syntax parsing, iOS Metro export, and native asset-catalog compilation passed. Compiled renditions were verified as 24/48/72 pixels; PNG RGB maxima are zero with transparency. React Native and native catalog copies match byte-for-byte. Validation output is in `/tmp/calmera-openai-logo-validation/` and the ignored `node_modules/.cache/calmera-openai-logo-check/export/`.

No simulator installation/restart, physical-phone use, account access, Git commit/push, or background-comparison edits were performed for this side task. A full native rebuild is required to pick up the new image catalog and native button support; a hot JS reload alone is insufficient. Runtime UI inspection and a full native app build were not performed in this side task.

The requested size refinement reduces all three placements from 24pt to 20pt. PNG variants are now 20/40/60 pixels; the native button takes its 20pt intrinsic image size from the asset catalog. The surrounding heading/row/button dimensions and original SVG are unchanged. Scoped lint and compilation of the resized image catalog passed; no simulator restart or Git operation was performed.
