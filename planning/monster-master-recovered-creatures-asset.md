# Recovery of Voidshard Reaver and Mossmaw Colossus art

Issue: #332. The earlier runtime `.webp` files were corrupt (one malformed
RIFF, one ASCII base64 text). No gameplay assignment or art ownership is changed.

The approved lossless masters remain only in the private **gameframe asset masters**
Drive folder. Public GameFrame ships optimized derivatives.

| Asset | Drive source file ID | Source SHA-256 | Runtime SHA-256 |
| --- | --- | --- | --- |
| Voidshard Reaver | `1ecVgyOowdlj3UzN5GPwo5sDL_EcgFxmc` | `fa593deb9bf47bd18c5e57b429ad89c85bdf736205e1d3d2e8b76b94e9fc3497` | `359570e2ab72b081110ccd3709ea8fdc6956a2a07bbf39de8e6bac3b8a922bb6` |
| Mossmaw Colossus | `15LHAhgyD1piJNOYaxGZWpT-hhIbOAyB5` | `0f83973bacb968339e5172ddea6b76044cf29594a921710ec2dac3520c603e0b` | `c1fe2e4ce28282539636dbee213efd3364f7f0d94dffc221f91bd7a0874779ea` |

## Promotion recipe

- `sharp@0.35.5` (already pinned in GameFrame), with libvips `8.18.7`.
- Source: the approved RGBA PNG from the Drive file ID above.
- `.resize(128, 192, {fit: "contain", background: {r: 0, g: 0, b: 0, alpha: 0}, kernel: "lanczos3"})`
- `.webp({quality: 88, effort: 6, alphaQuality: 100})`
- Target: `public/assets/monster-master/creatures/{voidshard-reaver,mossmaw-colossus}-v1-128.webp`.

The manifest records the source and output hashes, immutable Drive identities,
original provider and rights. Source masters are not committed. Source promotion
is reverified by `sharp` actual decoding, content SHA-256, dimensions, alpha and
the required Chromium `Image.decode()` and natural dimension assertion.

Both manifest entries retain `usage: "asset-library"`. This recovery does not
create new roles, rosters or combat capabilities.
