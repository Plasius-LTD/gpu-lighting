# Radial sampling policy release

Task #106, Story Plasius-LTD/plasius-ltd-site#2120, Feature #2114. The pure radial allocation function is promoted from the reviewed diagnostic branch without importing its experimental scenes, renderer transport or benchmark tooling into main. The implementation bytes remain unchanged from commit 2a5e60b.

The public index and lightweight radial-sampling entry expose the same function. Preserve exact area shares, deterministic circular distance/ties, ceilings 1–256 and the UHD pixel cap. Callers must compose renderer.sampling.adaptivePerPixel.enabled with their product capability/flag. This policy generates requested budgets; it neither measures actual completed samples nor proves image quality or performance. Renderer activation remains independently gated and unqualified by this release.

Acceptance: exact full-image histograms at native 1080p and UHD; bounded malformed input; arbitrary ceilings and integer rounding; identity across public source entry; ESM/CJS packed consumer equivalence; >=80% line coverage and changed-source LCOV; lint, syntax, build, privacy, package and Zero-Three checks; exact-head CI and approved main/production CD with registry integrity verification. README and Unreleased must describe the experimental policy accurately.

Local main-based qualification exposed a pre-existing capture bridge defect: its /gpu-lighting URL assumed the checkout directory was named gpu-lighting. Resolve that URL from the module-owned package directory and retain traversal checks. The existing two failing tests plus a traversal regression exercise the correction; no test or coverage gate is removed.
