# Retained source package

These numbered text chunks retain one base64-encoded `tar.gz` package containing the approved Monster Master rock source material and production records.

The wrapper archive and internal filenames are not trusted as the asset identity boundary. `scripts/monster-master-rock-props.mjs` accepts only PNG entries matching the approved master file SHA-256 values in the manifest, verifies their decoded RGBA pixel hashes and 1024×1024 dimensions, and materializes canonical source-master paths during `npm run assets:props:build`.

Do not edit, rewrap, or reorder individual chunks. Replace the complete package and update the approved per-master hashes through an explicit asset revision.
