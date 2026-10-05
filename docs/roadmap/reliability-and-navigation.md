# Reliability and navigation — work sequence

## 1. v0.43.0 Production Reliability

Реализация принята 2026-10-03:
- Приватный согласованный backup и первый запуск по расписанию подтверждены.
- Healthchecks API/WEB и guarded deployment приняты.
- Ротация логов и локальный монитор приняты.
- Retention preview принят; удаление выключено.
- Эксплуатационная инструкция и release notes подготовлены.

Публикация подтверждена: main и аннотированный тег v0.43.0 указывают
на 62520c69e2041ca669a6430c9487a81e3c4976ce.

Отложено:
- Внешнее зашифрованное хранение до согласования назначения.
- Внешние оповещения и мониторинг недоступности VDS.
- Реальное удаление backup до отдельной реализации и проверки.

## 2. WEB navigation and graph toolbar refinement

Priority: after v0.43.0, before the mobile application phase.
Status: implementation, targeted validation and VDS rollout completed;
WEB and Contacts correction accepted by the owner on 2026-10-05.
Git publication is recorded by remote main and annotated tag v0.44.0.
Implementation and storage semantics: docs/operations/web-workspace.md.

- The owner's approved layout has been implemented and accepted.
- Approved: one desktop header row without brand/search, dropdown navigation,
  a shared right inspector, light/dark themes and live graph previews.
- Aim for one elegant, compact primary navigation row on desktop.
- Review graph actions, filters, search, help and legend together to
  reduce the total header height and preserve graph space.
- Keep all existing destinations and actions accessible.
- Define overflow and responsive behaviour for narrow screens.
- Preserve keyboard access, visible focus and clear active states.
- Keep application-controlled text in English.
- Preserve the accepted design; no new redesign is planned.
- Validate the changed UI with synthetic contacts and images only.
- Do not commit the owner's screenshots, contact data or uploaded photos.
- This is targeted refinement, not a repeat of completed v0.39/v0.40 work.

## 3. iPhone application phase

Next checkpoint after Git publication of v0.44.0: mobile planning.
Technology is not selected yet. Define scope, authentication, private
data handling, navigation, graph interaction and distribution before coding.
Production contacts, photos, secrets and backups remain on the VDS outside Git;
no external storage or persistent offline contact cache is approved.

- Follow the accepted WEB information architecture.
- Adapt navigation and graph controls to native iPhone interaction,
  safe areas, accessibility and comfortable touch targets.
- Consult current Apple guidance when designing this phase.
- Do not force the desktop single-row layout onto a small screen.
- Choose the application technology in the mobile planning checkpoint;
  responsive WEB alone does not constitute a completed iPhone app.

## 4. Later project stages

- Full System Test / Release Candidate.
- Final documentation, targeted optimization and cleanup of genuinely unused
  caches/artifacts; preserve backups and rollback images. No early cleanup.
- Additional social/messaging adapters remain deferred.
