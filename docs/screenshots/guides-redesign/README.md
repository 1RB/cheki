# /guides redesign: before / after

Captured from local `next start` builds of `main` (479e81b, "before") and `guides/task-first-redesign` ("after"), Playwright Chromium, DPR 1, `--font-render-hinting=none`, viewport (above-the-fold) shots, touch emulation at 390. Light and dark follow `prefers-color-scheme`.

| Shot | What to look at |
| --- | --- |
| `*-guides-390-*.png` | Before: colour filter pills, a featured card with a tinted border, the first guide below the fold (card bottom at 913px of 844). After: grouped by job, plain rows; the first guide (How to verify a CBE receipt) ends at 420px. |
| `*-guides-1280-*.png` | Before: a three-column card grid sorted by date. After: section heading on the left, rows on the right. |
| `*-article-390-*.png` | Before: the TOC card sits above the title; green tracked-caps kicker and TOC bar. After: title first, ink labels, a collapsible "In this article", the Updated date. (Further down, callouts lose their tints and emoji, and steps lose the green circles.) |
| `after-guides-390-search-empty.png` | Search with no matches: the count line, "Clear search", the ink focus ring. |
