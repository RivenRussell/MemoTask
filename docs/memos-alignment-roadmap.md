# MemoTask v4 Memos Alignment Roadmap

This document records the four-stage plan for moving MemoTask toward the open-source Memos product experience while keeping MemoTask's AI-assisted Todo workflow.

## Goal

MemoTask v4 should feel visually and structurally closer to Memos:

- A timeline-first workspace instead of the current card grid.
- A compact, restrained UI with borders, smaller radii, and low-shadow surfaces.
- Fast memo capture near the feed.
- Search and tag-based navigation.
- Markdown-readable memo content.
- A later, explicit bridge between Markdown task lists and MemoTask's structured Todo model.

The goal is not to clone every Memos feature. Comments, reactions, public sharing, attachments, location, and multi-user social discovery are intentionally out of scope for the first v4 sequence.

## Version Sequence

The requested sequence is:

| Version | Stage | Commit purpose |
| --- | --- | --- |
| `v4.0.0` | Baseline | Current stable baseline plus this roadmap |
| `v4.1.0` | Stage 1 | Memos-like UI and timeline workspace |
| `v4.2.0` | Stage 2 | Tags and search (completed) |
| `v4.2.3` | Stage 3 | Markdown rendering (completed) |
| `v4.2.4` | Stage 4 | Markdown checkbox and structured Todo synchronization |

The `v4.2.3` and `v4.2.4` numbers are intentionally kept as requested, even though they are not a conventional major/minor sequence.

## Stage 1: Memos-like UI and Timeline Workspace

Version target: `v4.1.0`

### Objective

Replace the current soft glass/card-grid visual direction with a Memos-inspired workspace:

- Left narrow navigation.
- Center single-column memo timeline.
- Right utility sidebar for search, tags, history, and account context.
- Composer near the feed so memo capture feels like the primary action.

### Main changes

- Rework `src/components/AppShell.tsx`.
- Rework `src/pages/MemosPage.tsx`.
- Rework `src/components/MemoCard.tsx`.
- Rework the visual system in `src/styles.css`.
- Keep existing data and API contracts unless a UI-only prop reshape is needed.
- Preserve current auth, settings, history, detail, draft, and Todo behavior.

### Design constraints

- Use Memos as the visual reference, not the current MemoTask UI.
- Avoid decorative background assets, glassmorphism, large soft shadows, and oversized rounded cards.
- Prefer restrained borders, compact spacing, readable typography, and stable responsive layout.
- Do not add social Memos features in this stage.

### Acceptance criteria

- `/memos` renders as a timeline workspace, not a grid.
- Desktop layout has a narrow nav, feed column, and utility sidebar.
- Mobile layout collapses to a readable single-column feed.
- The memo item presentation feels like a feed item: author/time metadata, content, Todo summary, and compact actions.
- Existing UI, API, and e2e tests are updated to match the new intended UI.
- `npm test` and `npm run build` pass before the `v4.1.0` commit.

## Stage 2: Tags and Search

Version target: `v4.2.0`

### Objective

Add the core Memos-style organization layer without overbuilding a tag management system.

### Main changes

- Parse tags from memo title/content using `#tag` syntax.
- Show tags in the utility sidebar.
- Filter active memos by selected tag.
- Search memo title, content, and Todo titles.
- Keep the first implementation client-side unless performance requires API support.

### Design constraints

- Tags are derived from content in the first version.
- No dedicated tag database table in this stage.
- No tag rename, merge, delete, color, or management page.

### Acceptance criteria

- A memo containing `#work` contributes a `work` tag.
- Clicking a tag filters the feed.
- Search finds matches in memo titles, memo content, and Todo titles.
- Search and tag states can be cleared easily.
- Existing history/settings/capture behavior remains intact.
- `npm test` and `npm run build` pass before the `v4.2.0` commit.

## Stage 3: Markdown Rendering

Version target: `v4.2.3`

### Objective

Make memo content read like Memos content instead of plain text.

### Main changes

- Add a dedicated Markdown rendering component.
- Support GitHub Flavored Markdown basics:
  - headings
  - lists
  - links
  - blockquotes
  - inline code and fenced code blocks
  - tables
  - task-list checkbox display
- Use the renderer in timeline memo items and memo detail preview surfaces.

### Design constraints

- Do not treat Markdown task-list checkboxes as structured MemoTask Todos yet.
- Do not render unsafe raw HTML unless it is sanitized.
- Do not introduce a rich-text editor.
- Keep structured Todo panels and AI Todo generation as the execution layer.

### Acceptance criteria

- Markdown content renders readably in memo feed items.
- Markdown content renders readably in memo detail.
- Links, code, tables, and task-list checkbox visuals work.
- Raw HTML does not create script execution or unsafe DOM injection.
- `npm test` and `npm run build` pass before the `v4.2.3` commit.

## Stage 4: Markdown Checkbox and Structured Todo Synchronization

Version target: `v4.2.4`

### Objective

Bridge Markdown task-list items with MemoTask's structured Todo system using explicit synchronization rules.

### Recommended model

Structured Todo remains the source of truth.

Markdown checkboxes are plain content unless explicitly linked to a structured Todo. Linked Markdown checkboxes can update their corresponding Todo, and Todo changes can update the linked Markdown checkbox.

### Main changes

- Define a stable mapping between Markdown checkbox items and structured Todos.
- Prefer stable IDs over fuzzy title matching.
- Add migrations only if persistent link metadata cannot be safely represented with current fields.
- Update save/toggle flows so linked checkbox status and Todo status stay synchronized.
- Keep automatic archive logic based on structured Todos only.

### Conflict rules

- If a linked Markdown checkbox title changes, update the linked Todo title.
- If a linked Todo title changes, update the linked Markdown checkbox title.
- If a linked Markdown checkbox is deleted, do not silently hard-delete the Todo. Either unlink it or require an explicit Todo deletion action.
- Unlinked Markdown checkboxes do not count toward automatic archive.
- AI-generated Todos are not automatically written into Markdown unless a specific conversion action is introduced.

### Acceptance criteria

- A Markdown checkbox can be linked to a structured Todo.
- Toggling a linked Markdown checkbox updates the Todo status.
- Toggling a linked Todo updates the Markdown checkbox marker.
- Editing linked text updates the paired Todo title according to the chosen rule.
- Unlinked Markdown checkboxes remain content-only.
- Automatic archive behavior remains predictable.
- `npm test` and `npm run build` pass before the `v4.2.4` commit.

## Development Rules

- Each stage gets its own commit.
- Each stage commit should update `package.json` version to the target version.
- Each stage should update tests before committing.
- Each stage should be verified with `npm test`, `npm run build`, and relevant visual/e2e checks when UI behavior changes.
- Generated image assets should only be added if they materially support the product experience. If image generation is needed, use the requested GPT image model workflow.
- Keep changes surgical inside each stage. Do not implement later-stage features early unless they are required to make the current stage coherent.
