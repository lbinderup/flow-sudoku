# Flow Sudoku

A mobile-friendly sudoku generator with three technique-graded tiers and a low-tedium filter.

- **Easy**: singles only. **Medium**: pointing, box-line, naked/hidden pairs and triples. **Hard**: X-Wing, XY-Wing, XYZ-Wing, Swordfish.
- Every puzzle is checked by a logical solver so you always have at least 3 moves open - no hunting for the one cell that works.
- Notes, fill-all-candidates, auto-clearing notes, matching number and note highlights, digit-first input, rule-conflict highlighting, undo/redo, timer, per-tier stats, auto-save, light/dark theme.

- **Train** tab: drills for each technique taken from real generated puzzles, with step-by-step guidance when you tap cells, line counts for a chosen number, pattern drawing, and a Trainer button in Medium/Hard puzzles that turns on when the next move needs a pattern.

Single self-contained `index.html`; puzzles are generated in a Web Worker.
