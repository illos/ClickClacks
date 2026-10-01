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
site's generic double edge/bane is numerical ±4 and never grants a tier.

The copied motion contract has no version field/model registry and embeds motion
in retained acceptance receipts rather than a separate presentation table.
Compact catch-up results omit motion. Errors retain the original `ConvexError`
messages plus recognizable cursor-expiry messages, rather than a comprehensive
structured error-code contract. These are remaining interface work, not claims
of a new versioned replay protocol.

Package integration still needs a fresh separate consumer install using the
public exports and its own Convex component. A passing repository fixture proves
isolation and app forwarding, but does not alone prove a packed consumer artifact.
Actual screen-reader, device, enlarged/reflow and cross-viewer timing evidence
must be reported separately from pure/backend automated tests.
