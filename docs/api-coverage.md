# API coverage and remaining extraction work

The current stock-dice addition extends the copied V272 roller. It does not claim
completion of every capability in the earlier expanded extraction plan.

| Capability | Current public boundary |
| --- | --- |
| Pure values | `powerroller/dice`: identified mixed groups, bounded arbitrary side counts, supplied values, keep highest/lowest, discarded values, numeric modifiers, explicit percentile aggregation and secure generation |
| Draw Steel interpretation | `powerroller/draw-steel`: original tiered power roll, opposed totals/comparison, project total/breakthrough, saving throw and combat-opening chooser |
| Result text | `powerroller/format`: plain concise/detailed strings, including kept/discarded generic dice |
| Optional graphics | `powerroller/three`: original imperative tray, instance throw planner, model/record types and motion codec |
| Realtime lifecycle | `powerroller/client`: injected transport/identity/profile, stable IDs, accepted/available events, catch-up and explicit disposal |
| Component backend | Isolated original tables/functions, generated face binding, retained receipts/tombstones, shared reveal timing, private guest sessions, original shared-clear behavior and bounded cleanup |
| Site rolling | Original 2d10 power mode plus homogeneous d4/d6/d8/d10/d12/d20 pools, 1–20 dice |

Rules references are the pinned Compendium paths cited in the preset source and
tests. The project does not distribute that corpus. Presets interpret explicit
values; they do not execute abilities, end effects, award a turn or apply any
other campaign mutation. Project extra-die values are supplied explicitly by the
host, and breakthroughs inspect the original 2d10 faces.

The current collaborative endpoint does not yet represent mixed groups, per-die
request IDs, keep/drop, d3/d100, characteristic/labelled bonus input, project/save/
opposed rulesets, custom interpreted totals or bounded host context metadata.
These pure API capabilities can be used in a host's own local or authoritative
workflow; they are not secretly converted into a site power roll. The stock
site's generic bonus/penalty stages select 0, 2 and 5; the resulting modifier
is bonus value minus penalty value and never grants a tier. Power-roll Edge/Bane
math remains the original Draw Steel interpretation.

The copied motion contract now has explicit version 1 (absent means legacy v1),
with unsupported replay falling back to text. Per-request presentation storage
is separate from compact semantic receipts; catch-up does not read motion.
A configurable model registry remains future work. Public transport failures are
`RollerError` values with serializable `{code,message}` diagnostics. Explicit source
codes `REQUEST_CONFLICT`, `EXPIRED`, `CURSOR_EXPIRED`, `ROOM_EXPIRED`, `UNAUTHORIZED`,
`INVALID` and `INVALID_REQUEST` are preserved from Convex error data or a coded
message; other failures use `BACKEND_ERROR`. Messages retain the backend diagnosis
with private credentials redacted. This is a bounded public error contract, not a
complete taxonomy for every backend validation failure. Local controller
validation can still throw ordinary errors.

An independently installed packed artifact builds public dice/client/three
exports with React and CSS imports rejected, and typechecks installed component
source. Its generated component bindings are included in the package and excluded
from Git. Actual consumer component codegen and deployment are separate checks.
Actual screen-reader, device, enlarged/reflow and cross-viewer timing evidence
must be reported separately from pure/backend automated tests.
