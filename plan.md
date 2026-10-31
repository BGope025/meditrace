# MediTrace Frontend Refresh Plan

## Implementation approach

Replace the fragmented page-level shell with a cohesive operator console while preserving the existing Next.js App Router, API helpers, telemetry chart, QR scanner, and public verification routes. The dashboard remains API-first: it loads batches from the backend, falls back to clearly labelled demo records when the API is unavailable, and exposes create, breach, telemetry, and wallet handoff actions through the existing contracts.

Fix integration gaps found during audit: declare Axios in the client workspace, add the missing backend custody-transfer route/controller, validate API inputs, and keep secrets in environment files only. Add a route manifest entry for every public page.

## Project structure

- `client/src/app/page.tsx`: product landing page and navigation into operator/public workflows.
- `client/src/app/dashboard/page.tsx`: operator command center, filters, metrics, create-batch flow, batch detail drawer, telemetry and wallet actions.
- `client/src/app/verify/*`: public certificate lookup and telemetry verification.
- `client/src/components/*`: reusable scanner, chart, and provenance timeline.
- `client/src/lib/api.ts`: typed backend client and auth handling.
- `backend/controllers/*` and `backend/routes/*`: batch and telemetry API behavior.
- `plan.md` and `TODO.md`: implementation record and outcome status.

## Design

Three candidate styles: editorial logistics control room (0.04); clinical glassmorphism (0.07); industrial terminal dashboard (0.05). Chosen: **editorial logistics control room**.

- **Design movement:** Swiss editorial systems blended with modern operations software.
- **Core principles:** calm scanning, strong hierarchy, trust through visible evidence, progressive detail.
- **Color philosophy:** warm paper neutrals reduce clinical anxiety; deep ink anchors high-stakes actions; teal marks live infrastructure; coral is reserved for exceptions.
- **Layout paradigm:** persistent rail plus asymmetric command canvas, with dense tables balanced by spacious evidence panels.
- **Signature elements:** numbered section labels, thin rules, rounded status pills, and a soft radial grid motif.
- **Interaction philosophy:** every action explains its consequence; destructive or exceptional actions are explicit and reversible in the UI where possible.
- **Animation:** restrained entrance fades, pulsing live indicators, and no motion that competes with telemetry or alerts.
- **Typography:** system sans for readability, monospace for identifiers and timestamps, oversized editorial headings for orientation.
- **Brand essence:** make pharmaceutical provenance legible to the people responsible for keeping it safe. Personality: precise, calm, accountable.
- **Brand voice:** direct, evidence-led, never alarmist. Example lines: “See the signal behind every handoff.” and “Exceptions stay visible until resolved.”
- **Wordmark:** compact M monogram formed from two connected custody paths, paired with a precise wordmark.
- **Signature brand color:** electric teal `#27c3d6`, used only for live state and primary data accents.
