# Trainingstagebuch: Einrichtung

Die App besteht nur aus diesen Dateien:

```
index.html  styles.css  app.js  sw.js  manifest.webmanifest  icons/
```

Es gibt **zwei GitHub-Repos**:

| Repo | Sichtbarkeit | Inhalt |
|---|---|---|
| `training` | öffentlich (GitHub Pages) | nur der **Programmcode** der App |
| `trainingstagebuch-daten` | **privat** | deine **Trainingsdaten** (eine JSON-Datei, schreibt die App selbst) |

---

## 1. App online stellen (einmalig, ca. 5 min)

1. Auf <https://github.com> einloggen bzw. kostenlosen Account anlegen.
2. **+ → New repository**, Name `training`, **Public**, dann *Create repository*.
3. **„uploading an existing file“** anklicken und alle Dateien **plus den Ordner `icons`**
   aus `C:\asc\Training` hineinziehen (`ANLEITUNG.md` und `.claude` nicht nötig), dann **Commit changes**.
4. **Settings → Pages**: Branch `main`, Ordner `/ (root)`, **Save**.
5. Nach 1–2 Minuten steht dort die Adresse, z. B. `https://DEINNAME.github.io/training/`.

## 2. Privates Daten-Repo + Token (einmalig, ca. 5 min)

1. **+ → New repository**, Name `trainingstagebuch-daten`, **Private** (!), *Create repository*.
2. Profilbild → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**:
   - Name: `Trainingstagebuch`
   - Expiration: z. B. 1 Jahr (danach neuen Token erstellen und in der App eintragen)
   - Repository access: **Only select repositories** → `trainingstagebuch-daten`
   - Permissions → Repository permissions → **Contents: Read and write**
   - *Generate token* und den Token (`github_pat_…`) kopieren
3. Den Token nirgends sonst speichern oder weitergeben. Er gibt nur Zugriff auf das Daten-Repo.

## 3. Auf dem Handy installieren (Android)

1. Die Pages-Adresse in **Chrome** öffnen → Menü **⋮ → App installieren**.
2. In der App: **Mehr → Sync einrichten** → Benutzername, `trainingstagebuch-daten`, Token eintragen.

## 4. Auf dem Laptop installieren

1. Dieselbe Adresse in **Chrome oder Edge** öffnen → in der Adressleiste auf das **Installieren-Symbol** (Bildschirm mit Pfeil) klicken.
   Die App bekommt ein eigenes Fenster und einen Eintrag im Startmenü.
2. **Mehr → Sync einrichten** mit denselben Angaben.

Ab dann gleichen sich beide Geräte automatisch ab: nach jeder Änderung, beim Öffnen der App und wenn das Internet zurückkommt.
Der Punkt neben der Überschrift zeigt den Stand: 🟢 synchron · 🟡 wartet/läuft · 🔴 Fehler (antippen = jetzt synchronisieren).
Offline eintragen geht immer. Der Sync wird nachgeholt.

## Bedienung im Überblick

- **Heute**: Training des Tages, Daily Quest (🎲 neu würfeln), Wochenstatistik, offene ToDos, Wettkampf-Countdown
- **Kalender**: Einheiten nach Kategorie (Grundlagen · Kraft · Technik); „Wochenvorlage einfügen“ legt Di (Kraft zuhause) und Do (Kraftraum) an
  - **Kraft**: Übungen mit Sätzen/Gewicht planen, abhaken, „Aus letzter Einheit übernehmen“
  - **Technik**: Inhalt + Journal für Gedanken & Ideen
  - **Grundlagen**: Inhalt nach dem Training eintragen
- **Leistung**: Bestleistungen mit Verlauf (Stabhochsprung hervorgehoben) und Wettkämpfe
- **Notizen**: Infos & ToDos (Anlauf, Staffelwechsel, ToDo, Allgemein) und das gesammelte **Technik-Journal** mit Suche
- **Auswertung** (Laptop-Seitenleiste, am Handy unter „Mehr“): Trainingszeit und Belastung pro Woche, Verteilung, Kraft-Entwicklung je Übung, PB-Übersicht, durchsuchbare Tabelle aller Einheiten, CSV-Export (z. B. für Excel)
- **Mehr**: Sync, Quest-Pool, Wochenvorlage, Backup

## Später etwas ändern

Geänderte Dateien wieder ins Repo `training` hochladen und in `sw.js` die Zeile
`const CACHE = 'trainingstagebuch-v2';` hochzählen (`-v3`, `-v4` …).
Das Update ist nach dem **zweiten** Öffnen der App sichtbar. Deine Daten bleiben dabei erhalten.
