# Auf Railway veröffentlichen, Schritt für Schritt

## 1. Code zu GitHub

Im Projektordner (Git muss installiert sein):

```
git init
git add .
git commit -m "Minigolf Duell"
git branch -M main
git remote add origin https://github.com/DEIN-NAME/minigolf-duell.git
git push -u origin main
```

Das Repository vorher auf github.com anlegen (leer, ohne README). Privat ist in Ordnung.

## 2. Service in Railway

1. Railway öffnen, Projekt wählen (oder "New Project").
2. **New**, **GitHub Repo**, `minigolf-duell` auswählen.
3. Railway baut und startet automatisch. Die Datei `railway.json` setzt Start und Healthcheck (`/healthz`).

## 3. Volume anlegen (wichtig)

1. Service öffnen, **Settings**, **Volumes** (oder Rechtsklick auf den Service, **Attach Volume**).
2. Mount-Pfad: `/data`.
3. Der Server erkennt das Volume selbst und speichert dort `games.json`. Falls nicht, unter **Variables** setzen: `DATA_FILE` = `/data/games.json`.

Ohne Volume sind die Spiele nach jedem Neustart weg.

## 4. Domain

Service, **Settings**, **Networking**, **Generate Domain**. Ergebnis: `https://irgendwas.up.railway.app`. Diesen Link im Browser öffnen, Namen eingeben, Spiel erstellen.

## 5. Prüfen

- `https://DEINE-DOMAIN/healthz` zeigt `{"ok":true,...}`
- Spiel erstellen, Link an den Mitspieler schicken
- Nach einem Redeploy muss das Spiel noch da sein (Test fürs Volume)

## Hinweise

- Nur eine Instanz laufen lassen (nicht skalieren).
- Updates: Änderungen committen und pushen, Railway deployt automatisch.
- Kosten: Railway rechnet nach Nutzung ab. Das Spiel braucht sehr wenig, im Dashboard unter Usage prüfen.
