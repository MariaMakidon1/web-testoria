# Feature Docs

One file per product feature. Each file describes what the feature does, who uses it, key behaviours, and any constraints or edge cases.

## Naming

`<feature-name>.md` — use kebab-case, match the domain name used in `src/`.

Examples: `test-cases.md`, `test-runs.md`, `milestones.md`, `user-management.md`

## When to create / update

- **New feature implemented** → create a new file here as part of the execution plan.
- **Existing feature changed** → update the relevant file here before closing the plan.

## What to include

```
# Feature: <Name>

## What it does
One paragraph summary.

## Who uses it
Table of roles and what they can do.

## Key behaviours
Bullet list of the most important rules and flows.

## Constraints / edge cases
Anything non-obvious that future engineers need to know.

## Related docs
Links to architecture, API schema, or engineering pattern docs.
```
