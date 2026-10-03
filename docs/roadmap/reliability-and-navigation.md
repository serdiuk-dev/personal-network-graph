# Reliability and navigation — work sequence

## 1. Complete v0.43.0 Production Reliability

Accepted checkpoints:
- Private paired PostgreSQL/media backup automation.
- API/WEB healthchecks and guarded same-image deployment.
- Production acceptance is recorded in the operations documents.

Remaining work:
- Container log limits and local backup/health monitoring are implemented and production-validated; ongoing monitoring remains operational.
- Observe the first scheduled backup; it is not yet confirmed.
- Define retention initially without deleting existing backups.
- Encrypted off-server backup remains deferred until the owner selects
  and authorizes a destination; private data currently stays on the VDS.
- Complete the operational runbook and release checkpoint.

## 2. WEB navigation and graph toolbar refinement

Priority: after v0.43.0, before the mobile application phase.
Status: requested; implementation has not started.

- Use the owner's current screenshot as the starting point.
- Obtain the owner's proposed layout, annotated images and descriptions.
- Aim for one elegant, compact primary navigation row on desktop.
- Review graph actions, filters, search, help and legend together to
  reduce the total header height and preserve graph space.
- Keep all existing destinations and actions accessible.
- Define overflow and responsive behaviour for narrow screens.
- Preserve keyboard access, visible focus and clear active states.
- Keep application-controlled text in English.
- Review a proposed layout with the owner before implementation.
- Validate the changed UI with synthetic contacts and images only.
- Do not commit the owner's screenshots, contact data or uploaded photos.
- This is targeted refinement, not a repeat of completed v0.39/v0.40 work.

## 3. iPhone application phase

- Follow the accepted WEB information architecture.
- Adapt navigation and graph controls to native iPhone interaction,
  safe areas, accessibility and comfortable touch targets.
- Consult current Apple guidance when designing this phase.
- Do not force the desktop single-row layout onto a small screen.
- Choose the application technology in the mobile planning checkpoint;
  responsive WEB alone does not constitute a completed iPhone app.

## 4. Later project stages

- Full System Test / Release Candidate.
- Final documentation and targeted cleanup.
- Additional social/messaging adapters remain deferred.
