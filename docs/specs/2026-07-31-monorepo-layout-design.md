# Design: monorepo layout refactor (backend/, one component per file)

Date: 2026-07-31
Status: landed 2026-07-31 on branch `refactor/monorepo-layout` (commits 1cdcc3b, 3001ff5,
4cc7e16, 07584d9, 96ea77c, 2f5bc54, f88853c, plus review fixes) — not yet merged to main

## Problem Statement

The repository has grown into three applications — the Python backend, the marketing
dashboard, and the dev console — but only two of them look like applications. The backend's
`src/`, `tests/`, `migrations/`, `scripts/`, `pyproject.toml`, `uv.lock` and `alembic.ini` are
scattered across the repository root, so the root directory reads as "a Python project that
happens to contain two React apps" rather than as a monorepo with three peers. Someone opening
the repo cannot tell where the backend begins and ends.

Inside the dashboard, seven files each hold between two and seven React components. The
settings view alone is 404 lines containing a view, a card wrapper and five section
components; the generate view is 322 lines containing a view and two chip components. Finding
the component that renders a given piece of UI means reading a file top to bottom, and any
edit to one section touches a file that five unrelated sections also live in. The dev console
has the same problem in one place, where a single file holds a tab and five card components.

Three further things actively mislead a reader:

- A helper named `splitHashtags` exists three times. Two copies are byte-identical; the third
  has the same name but a different algorithm and a different return shape. Nothing signals
  that the third is not interchangeable with the other two.
- Three blocks of commented-out code sit in the dashboard, one of which leaves an exported
  helper and a table of default skill content reachable only from inside a comment, and leaves
  two fields on the PNG-export options object that every caller populates and the function
  ignores.
- Four tests fail. All four assert UI that was deliberately removed in an earlier commit, so
  the suite reports failure for work that was actually correct — and a red suite cannot serve
  as evidence that any later change was safe.

Separately, the repository contains two `docker-compose.yml` files and nothing states why. A
reader must diff them to discover that one is a local development stack and the other a
production deployment descriptor, and the deployment README refers throughout to an image
version that does not exist in the compose file, in `pyproject.toml`, or on disk.

## Solution

Restructure the repository into three peer applications, split every React component into its
own file inside a directory structure that mirrors the product's own navigation, and remove
the code and duplication that currently misleads readers — all without changing a single
behaviour a user could observe.

After the change:

- The repository root contains `backend/`, `frontend/`, `dev-console/`, `deploy/`, `docs/`,
  and the handful of files that genuinely belong to the whole repo. Every Python artefact
  lives under `backend/` and that directory is self-contained.
- Each view in the dashboard is a directory holding the view, the components only it uses,
  and its test. Genuinely shared components remain in a shared directory. The dev console
  follows the same shape with tabs in place of views.
- The two same-named-but-different hashtag helpers are told apart: the genuinely shared one
  moves to the shared library, and the odd one out is renamed to describe what it actually
  does and stays with its single caller.
- The commented-out blocks are gone, along with every symbol they were the last reference to.
- The test suites are green, and they are green because they describe the UI that actually
  ships.
- Both compose files remain, each carrying a comment stating what it is for, and the version
  numbers across the backend, both frontends, the deployment compose and the deployment
  README all agree.

The work is behaviour-preserving throughout. Every existing test keeps its assertions; the
only permitted test edits are the four that describe a UI that no longer exists, and import
paths.

## User Stories

1. As a developer opening the repository for the first time, I want the root directory to show
   three clearly named applications, so that I can tell what this project is composed of
   without reading any code.
2. As a developer looking for backend code, I want every Python artefact under a single
   `backend/` directory, so that I never have to guess whether a root-level file belongs to
   the API or to the build.
3. As a developer running the backend test suite, I want a documented command that works from
   the backend directory, so that I do not have to discover the new working directory by
   trial and error.
4. As a developer adding a new API route, I want the backend's internal package layout to be
   exactly as it was, so that the move does not invalidate everything I already know about
   where things live.
5. As a developer running database migrations, I want Alembic to resolve its migration
   directory without configuration changes after the move, so that provisioning keeps working
   untouched.
6. As an operator deploying the stack, I want the deployment build command in the README to
   keep working verbatim after the restructure, so that my deployment runbook does not silently
   go stale.
7. As an operator reading the deployment README, I want the image version it names to match
   the version in the compose file and the artefact on disk, so that I do not follow the
   instructions and find a missing file.
8. As a developer cloning the repository fresh, I want the migrations directory to be tracked
   in version control, so that the API can provision its schema on first boot.
9. As a developer starting the local stack, I want the local compose file to say that it is
   for local development and to point at the deployment one, so that I never wonder which of
   the two I should be running.
10. As a developer running compose commands, I want no deprecation warnings printed on every
    invocation, so that real warnings are not lost in noise.
11. As a developer looking for the component that renders a settings section, I want that
    section to be its own file named after itself, so that I can find it by filename alone.
12. As a developer editing one settings section, I want my change to touch a file that only
    that section lives in, so that the diff shows what I actually changed.
13. As a developer navigating the dashboard, I want each view to be a directory containing the
    view and only the components it uses, so that the file tree tells me what belongs to what.
14. As a developer looking for a shared component, I want the shared components directory to
    contain only genuinely shared components, so that its contents are a meaningful list.
15. As a developer opening a component file, I want its test to sit beside it, so that I can
    read the behaviour contract without searching a separate tree.
16. As a developer deleting or moving a component, I want its test to move with it as a matter
    of course, so that tests cannot be orphaned by a refactor.
17. As a developer reading a text-formatting helper, I want two helpers with different
    behaviour to have different names, so that I do not assume they are interchangeable.
18. As a developer needing to split hashtags out of a caption, I want one shared implementation
    in the shared library, so that I do not write a third copy.
19. As a developer reading the PNG export module, I want its options object to declare only
    fields the function actually uses, so that I do not pass data that is silently discarded.
20. As a developer reading any file in the dashboard, I want no commented-out code blocks, so
    that everything I read is code that runs.
21. As a developer relying on the type checker, I want no unreferenced exports left behind by
    the cleanup, so that an unused-symbol error means something real.
22. As a developer running the dashboard test suite, I want it to pass, so that a failure tells
    me I broke something.
23. As a developer reading a failing test, I want its assertions to describe the UI that ships
    today, so that I fix the code rather than discovering the test was wrong.
24. As a developer reviewing this refactor, I want the existing tests to keep their assertions
    unchanged, so that their passing is real evidence that behaviour was preserved.
25. As a developer reviewing the backend move, I want it to appear in version control as pure
    renames, so that I can confirm at a glance that no content changed.
26. As a developer using the dev console, I want its settings tab split into one file per card,
    so that the largest file in that app stops being a catch-all.
27. As a developer switching between the two React apps, I want them to follow the same
    directory conventions, so that what I learn in one transfers to the other.
28. As a user of the dashboard, I want every screen to look and behave exactly as it did before
    the refactor, so that a structural change costs me nothing.
29. As a user exporting a post as an image, I want the export to produce the same image as
    before, so that removing dead code does not change my output.
30. As a user of the research view, I want tab switching and the refresh button to work exactly
    as before, so that the view's rewrite of its tests changes nothing I can see.
31. As an agent working in this repository, I want one component per file with descriptive
    names, so that I can locate the right file without reading unrelated code.
32. As an agent making a change, I want the directory structure to make the correct location
    for new code obvious, so that I do not invent a parallel home for an existing concern.
33. As a maintainer, I want the historical design documents left unedited, so that they
    continue to describe what was true when they were written.
34. As a maintainer, I want the live documentation updated to the new paths and commands, so
    that setup instructions work as written.
35. As a maintainer reading the credential helper scripts, I want their docstrings to reference
    the new module paths, so that the primary home for credential knowledge stays accurate.
36. As a maintainer, I want each step of this refactor committed separately, so that any single
    step can be reverted without unpicking the others.
37. As a maintainer, I want the version number consistent across the backend, both frontends
    and the deployment descriptor, so that a deployed image can be traced to a commit.

## Implementation Decisions

### Repository shape

The repository becomes three peer applications plus deployment and documentation. All Python
artefacts — application source, tests, migrations, credential helper scripts, the project
metadata, the lockfile and the Alembic configuration — move under a single backend directory.
The src-layout is retained, so the application package remains one level below the backend
root; this preserves the guard against tests importing an uninstalled copy of the package, and
means the package build configuration and the test path configuration need only their prefix
adjusted.

Consequences accepted:

- Backend commands are run from the backend directory rather than the repository root.
- The virtual environment is regenerated in its new location rather than moved.
- The container ignore file is updated for the new prefixes.

Two path resolutions were verified to survive the move without edits: the bootstrap module
locates the migrations directory by walking up a fixed number of parents from itself, and the
Alembic configuration locates it relative to its own directory. Because the module, the
configuration and the migrations directory all move together and preserve their relative
positions, both continue to resolve correctly. This is a deliberate constraint on the move,
not a coincidence to be discovered later: migrations must move with the backend, not stay at
the root.

### Backend internals

The backend's internal package structure is not changed. Its packages are cohesive and the
test tree already mirrors them package for package. Renaming modules would churn every import
statement for no navigational gain, and each rename is an opportunity to break an import that
no test covers. The move is a relocation only.

### Migrations

The migrations directory was deleted in an earlier commit and has since been restored to the
working tree, but is not yet tracked. It must be added to version control as part of this
work. Until it is, a fresh clone cannot provision a schema, because schema provisioning runs
on startup for both the API and the worker by default.

### Container image

The image build descriptor stays at the repository root, with its copy paths updated. It is
not a backend descriptor despite its image name: its first stage builds the dashboard with
Node and its second stage copies the built dashboard into the Python image. Placing it under
the backend directory would misrepresent what it builds and would force it to reach outside
its own directory. Keeping it at the root also means the local compose build directive and the
documented deployment build command continue to work verbatim.

### Compose files

Both compose files are required and are not merged. They share only the two process commands;
they differ in image source (built locally versus loaded from an archive), database image
version, volume name and mount path, network (default bridge versus an external network),
exposure model (published ports versus internal-only), environment mechanism (an env file with
two overrides versus a large hand-filled anchor block), and in the extra services each carries.
Decisively, the deployment file is documented as being copied to a server on its own and
edited there — an override chain would break that workflow.

Three defects are fixed instead: the obsolete top-level version key, the deprecated external
network syntax, and the version drift between the deployment README and everything else. A
header comment is added to the local file identifying it as local-development-only and pointing
at the deployment one, which is the actual answer to "why are there two of these".

### Dashboard structure

Each view becomes a directory containing the view, the components used only by that view, and
the view's test. The shared components directory retains only components used by more than one
view. This extends the pattern the research view already uses rather than introducing a new
one.

Fourteen components currently sharing a file with their parent are extracted, each to a file
named after itself. Small pure helpers that serve only one component remain with that
component: the rule is one *component* per file, not one symbol per file.

Loose modules at the source root are placed with the concerns they belong to: the fetch wrapper
joins the other library modules, the icon component joins the shared components, and the two
context modules move to a providers directory, each split so that the provider component and
its consumer hook are separate files. The application entry point, the root component and the
shared type module remain at the root.

The dev console mirrors this: each tab becomes a directory, and its settings tab is split into
one file per card.

### Duplicated helper

Of the three same-named hashtag helpers, two are byte-identical and one is a different
algorithm returning a different shape. The two identical copies are replaced by a single shared
implementation in the library. The third is renamed to describe what it actually does — split
at the first hashtag rather than extract hashtags from anywhere — and stays with its single
caller. Unifying all three onto one implementation was rejected: it would change what the home
view renders for any caption with a hashtag in the middle, which is a behaviour change.

### Dead code removal

Three commented-out blocks are deleted, together with every symbol they were the last reference
to. This cascades to a canvas text-wrapping helper and its two tests, a table of default skill
content, a reset handler, and two fields on the export options object along with the call sites
that populate them. The table of default agent content is unaffected and remains in use.

### Stale tests

Four failing tests assert UI that was intentionally removed. Three assert a two-step source
picker in the research view that has been replaced by an always-visible tab row; the fourth
asserts a scrim is drawn over the exported image, which was one of the commented-out blocks.
They are rewritten to describe the shipping UI — tab switching, the refresh button busting its
cache key, and per-tab rendering — rather than deleted, so the research view does not enter a
refactor with no coverage. This lands as its own commit before any restructuring, so that the
green suite is a genuine baseline.

### Versioning

The version is bumped across the backend metadata, both frontend manifests and the deployment
compose, and a matching image archive is built, so that the deployment README's instructions
resolve against an artefact that exists.

### Sequencing

The work lands as a sequence of commits on a feature branch, each independently revertible:
baseline test fixes, dead code removal, the backend move, compose fixes, the dashboard
restructure, the dev console restructure, the version bump and image rebuild, and finally the
documentation updates. The backend move and compose fixes come first because they are
mechanical and quickly verified; the dashboard restructure, the only part carrying real
judgement, lands against a stable base.

## Testing Decisions

### What makes a good test here

A good test in this change is one that **does not change**. The refactor is behaviour-
preserving, so every existing test is a regression oracle, and its value comes precisely from
its assertions being untouched. A test that had to be edited to accommodate the refactor proves
nothing about the refactor. The only edits permitted are import paths, which are location not
contract, and the four tests that describe UI that no longer exists.

Correspondingly, no new test is written *because of* this refactor. A test that exists only
because a component was extracted is testing the extraction — that is, the implementation —
rather than any behaviour a user has. Coverage is asserted at the highest seam that can observe
the behaviour, and extraction happens below that seam by construction.

### Seams

Five seams, all of which already exist. No new seam is introduced.

1. **Backend boot, through the real application lifespan.** The existing boot smoke test builds
   the application and drives it through startup, so database provisioning, real migration
   execution against a fresh database, and default seeding all fire, followed by requests
   across the health, configuration, ingestion and data routes. This is the load-bearing seam
   for the backend move: it is the only test that exercises migration path resolution for real.
   If the move breaks how the bootstrap module or the Alembic configuration locates migrations,
   this is what reports it.

2. **Dashboard views, rendered through the testing library.** Each view test renders the view
   inside the toast provider with the network stubbed, and asserts on visible text and
   accessible roles. This seam sits above all fourteen extracted components, so extraction is
   invisible to it — props go in, DOM comes out, and the internal file boundaries are not
   observable. This is the load-bearing seam for the dashboard restructure.

3. **Library modules, called directly.** The cache, derivation, streaming, PNG export, fetch
   wrapper and request hook modules are exercised as units. Unchanged by this work beyond
   import paths, and retained because they cover calculation-heavy logic — image crop geometry
   and KPI derivation — that a view-level assertion would only cover incidentally.

4. **The TypeScript compiler.** Both React apps compile with unused locals and unused
   parameters treated as errors, which makes a clean build the direct proof that neither the
   component extraction nor the dead-code cascade left an orphan behind.

5. **Image build and compose validation.** Building the image proves the container copy paths
   against the new layout; validating both compose files proves their syntax. Run manually as
   part of the relevant commits; deliberately not automated, as automating it would add a slow
   seam that exists only for this change.

### Modules tested

Every module already under test stays under test, at the same seam, with the same assertions.
No module gains or loses coverage as a result of this work, with two deliberate exceptions:
the canvas text-wrapping helper loses its two tests because the helper itself is deleted, and
the research view's three tests are rewritten against the current UI.

### Explicit non-seams

- The newly shared hashtag helper gets no unit test. Its behaviour is not changing, and it
  remains covered through the two view tests that render its output. Adding a unit test would
  create a seam that exists only because a function changed address.
- The fourteen extracted components get no individual tests. They are covered at the view seam
  above them, which is the higher seam and the one that survives further restructuring.
- The single existing view test per view is not split to match the extracted components.
  Redistributing assertions during a refactor makes a behaviour change and a test change
  indistinguishable in review.

### Prior art

The boot smoke test is the established pattern for end-to-end verification through the real
application lifespan, kept in its own file and its own database so that a provisioning or
wiring failure is never confused with a hermetic unit failure. The static dashboard tests are
the established pattern for request-level assertions against a constructed application. The
dashboard view tests are the established pattern for rendering a view with the network stubbed
and asserting on roles and visible text.

One incidental coupling is noted rather than fixed: one static dashboard test asserts that a
project metadata file is not reachable over HTTP, which depends on that file being present in
the working directory. After the move, tests run from the backend directory where that file is
present, so the assertion continues to hold — but it is incidental, and would become vacuous
rather than failing if the suite were ever run from the repository root.

### Verification environment

The backend suite cannot run against the configured test database, which points at an
unreachable remote host, and no container runtime is available on the host platform. A
throwaway database container is started under the Linux subsystem for the duration of this
work, with the test database URL supplied to the test process only. The environment file is
not modified and the remote host is never contacted. The container is removed when the work
completes.

## Out of Scope

- **Restructuring the backend's internal packages.** No module inside the application package
  is renamed, split or regrouped. Consolidating the route modules was considered and rejected
  for this change.
- **Merging the two compose files.** Both are required; the analysis is recorded above.
- **Splitting test files to match extracted components.** Deferred; may be taken up separately
  against a proven-good baseline.
- **Adding coverage for anything currently untested.** This change neither adds nor removes
  coverage except where a tested symbol is deleted.
- **Editing the archived design and plan documents.** They are dated records of what was true
  when written and are left untouched, per the repository's retention convention.
- **Behaviour, styling and layout changes of any kind.** Nothing a user can observe changes.
  Where a cleanup would have altered rendering — unifying the three hashtag helpers — the
  cleanup was scoped down instead.
- **Re-enabling the removed features.** The image caption overlay, the image scrim and the
  reset-skill-to-default control are deleted, not reinstated. Restoring any of them is a
  product decision and its own piece of work.
- **Deleting the older image archives.** The two previously built archives are left in place.
- **Introducing a project-level agent briefing file.** Not requested.

## Further Notes

**Deviation from the spec template.** The template instructs that file paths be omitted because
they go stale. This spec is about file paths: the target directory structure is the deliverable,
not an incidental detail. Structure is therefore described in prose and by responsibility
throughout — naming directories and their contents where that *is* the decision — while
avoiding specific file paths and code snippets, which would go stale as the template warns.

**Two findings that pre-date this work and are fixed within it.** The migrations directory was
deleted in an earlier commit while the code that runs migrations on startup was left in place,
which left a fresh clone unable to provision a schema. And the deployment README was advanced
to an image version that exists nowhere else in the repository. Neither was part of the original
request; both are repaired here because this change moves and rebuilds exactly those artefacts,
and leaving them would mean shipping a restructure on top of a broken bootstrap.

**Why the four failing tests are rewritten rather than deleted.** They are the only coverage the
research view has, and the research view is being restructured. Deleting them would remove the
oracle at precisely the moment it is most needed. Rewriting them costs one commit and yields a
baseline against which the restructure can be shown to be safe.

**Risk on the image rebuild.** The image is built from a Windows-mounted filesystem inside the
Linux subsystem. Cross-filesystem container builds over that mount are slow and this particular
build has not been performed before. If it proves impractical, that is reported rather than
quietly skipped, and the version bump lands without a matching archive — which would leave the
deployment README pointing at an artefact that does not yet exist, so the bump should then be
reconsidered rather than left half-applied.

**Working directory change.** Backend commands move from the repository root to the backend
directory. This affects the documented setup instructions, the credential helper invocation in
the README, and any saved developer notes about how to run the suite.
