# GitHub-Repo-Settings: PR-Checks & Auto-Merge

**Datum:** 2026-07-06
**Status:** Workflow aktiv, Settings müssen einmalig manuell gesetzt werden

---

## Ziel

Jeder PR gegen `main` wird automatisch getestet (Lint + Build + Test + E2E),
und PRs können per Auto-Merge gemergt werden, sobald die Checks grün sind.
Fehlerhafte PRs (z. B. von Renovate oder automatisierten Sessions) landen
damit nicht mehr ungeprüft auf `main`.

## Was bereits im Repo liegt

| Datei | Zweck |
| --- | --- |
| `.github/workflows/ci.yml` | CI-Workflow: Jobs **Lint** (`npm run lint`), **Build** (`npm run build`), **Test** (`npm run test` — Vitest, unit + jsdom) und **E2E** (`npm run test:e2e` — Playwright im echten Browser) laufen bei jedem PR und bei Pushes auf `main` |
| `.github/rulesets/main-branch-protection.json` | Importierbares Ruleset, das die vier Checks für `main` verpflichtend macht |
| `renovate.json` | Renovate merged Minor/Patch/Pin/Digest-Updates automatisch, sobald die Checks grün sind |

## Einmalige manuelle Schritte (GitHub-UI)

Repo-Settings lassen sich nicht per Datei im Repo setzen — diese zwei Schritte
müssen einmalig in der GitHub-Oberfläche gemacht werden:

### 1. Auto-Merge erlauben

**Settings → General → Pull Requests**

- [x] **Allow auto-merge** aktivieren
- Optional, aber empfohlen: **Automatically delete head branches** aktivieren

### 2. Ruleset importieren

**Settings → Rules → Rulesets → New ruleset ▾ → Import a ruleset**

Datei `.github/rulesets/main-branch-protection.json` auswählen und speichern.

Das Ruleset erzwingt für `main`:

- **Pull Request Pflicht** — keine direkten Pushes auf `main` (0 Approvals
  nötig, du kannst deine eigenen PRs also sofort mergen)
- **Required Status Checks** — die Jobs `Lint`, `Build`, `Test` und
  `E2E against preview` müssen grün sein. Bewusst *nicht* strict
  (`strict_required_status_checks_policy: false`): Ein PR, der hinter `main`
  zurückliegt, darf trotzdem mergen. Sonst gewinnt bei mehreren grünen PRs
  immer nur einer, und alle anderen müssen aktualisiert werden und die CI
  erneut durchlaufen. Die PR-CI testet ohnehin den Merge-Ref (PR + `main` zum
  Zeitpunkt des Laufs); was zwei PRs erst gemeinsam kaputt machen, fängt die
  CI auf `main` (läuft bei jedem Push). (`E2E against preview` kommt aus `preview-deploy.yml` und testet
  gegen das deployte PR-Preview. Lokal bleibt `npm run test:e2e` für die
  Entwicklung verfügbar.)
- **Required Deployment** — die `preview`-Environment (aus
  `preview-deploy.yml`) muss erfolgreich deployt sein, bevor gemerged werden
  kann
- **Required Linear History** — keine Merge-Commits auf `main`; nur Squash
  oder Rebase
- **Kein Force-Push, kein Branch-Delete** auf `main`
- **Bypass für Repository-Admins** — du selbst kannst im Notfall weiterhin
  direkt auf `main` pushen; Bots (Renovate, GitHub Actions) können das nicht.
  Wer den Bypass nicht will, entfernt im Ruleset den Eintrag unter
  "Bypass list".

## Wie Auto-Merge dann funktioniert

- **Eigene PRs:** Im PR auf **Enable auto-merge** klicken. GitHub merged
  automatisch, sobald Lint + Build grün sind.
- **Renovate-PRs:** Renovate aktiviert Auto-Merge selbst für Minor-, Patch-,
  Pin- und Digest-Updates (`renovate.json`). Major-Updates bleiben zur
  manuellen Prüfung offen.

## Wichtig bei Änderungen am Workflow

Die Check-Namen im Ruleset (`Lint`, `Build`) müssen mit den Job-`name`-Feldern
in `.github/workflows/ci.yml` übereinstimmen. Wer Jobs umbenennt oder ergänzt,
muss das Ruleset unter **Settings → Rules → Rulesets** entsprechend anpassen —
sonst warten PRs ewig auf einen Check, der nie kommt.
