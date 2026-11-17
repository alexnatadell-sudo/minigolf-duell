# Minigolf Duell

Zwei Spieler, neun Bahnen mit steigendem Schwierigkeitsgrad, abwechselnd schlagen. Der Server rechnet jeden Schlag, speichert die Partie und beide Spieler sehen dasselbe. Ihr müsst nicht gleichzeitig online sein.

## Lokal testen (Windows, Mac, Linux)

1. Node.js installieren (Version 18 oder neuer): https://nodejs.org
2. Ordner entpacken, in diesem Ordner ein Terminal öffnen.
3. Starten:

```
node server.js
```

4. Im Browser öffnen: http://localhost:3020
5. Name eingeben, "Neues Spiel erstellen", den Link an den Mitspieler schicken.

Zum Testen allein: zweites Browserfenster im privaten Modus öffnen und den Link dort einfügen.

Mit dem Handy im selben WLAN: statt `localhost` die IP des PCs nehmen, z. B. `http://192.168.1.20:3020` (Windows: `ipconfig`).

Anderer Port: `PORT=4000 node server.js` (Windows PowerShell: `$env:PORT=4000; node server.js`).

## Später veröffentlichen (Server im Internet)

1. Ordner auf den Server kopieren (kein `npm install` nötig, es gibt keine Abhängigkeiten).
2. Dauerhaft starten, z. B. mit pm2: `pm2 start server.js --name minigolf` und `pm2 save`.
3. Port in der Firewall freigeben (Standard 3020).
4. Link: `http://SERVER-IP:3020/`

Gespeichert wird in `data/games.json` (Spiele älter als 90 Tage werden beim Start gelöscht). Diesen Ordner beim Update nicht überschreiben.

Hinweis: Ohne HTTPS sind Namen und Spielzüge unverschlüsselt. Für ein Spiel unter Freunden ist das vertretbar, für mehr braucht es einen Reverse Proxy mit Zertifikat (z. B. Caddy).

## Auf Railway veröffentlichen (ausführlich: DEPLOY-RAILWAY.md)

1. Ordner in ein GitHub-Repository legen (oder Railway CLI nutzen).
2. In Railway: New Service, Deploy from GitHub Repo. Node wird automatisch erkannt, Start per `npm start`.
3. Wichtig: ein Volume anlegen (Service, Settings, Volumes), Mount-Pfad z. B. `/data`. Ohne Volume sind alle Spiele nach jedem Neustart weg. Der Server nutzt das Volume automatisch. Falls nicht, Variable `DATA_FILE=/data/games.json` setzen.
4. Unter Networking eine Domain erzeugen. Sie hat HTTPS, der Link sieht aus wie `https://dein-name.up.railway.app/`.
5. Nur eine Instanz laufen lassen (nicht skalieren), weil die Spiele in einer Datei liegen.

## Regeln

- Abwechselnd schlagen. Wer die Bahn zuerst beendet, wartet, der andere spielt weiter.
- Jede Bahn beginnt abwechselnd: Bahn 1 Spieler 1, Bahn 2 Spieler 2, usw.
- Weniger Schläge insgesamt gewinnt.
- Wasser: +1 Strafschlag, der Ball geht zurück an die letzte Position.
- Sand bremst stark.
- Rempeln: Wer den gegnerischen Ball trifft, schiebt ihn weg. Landet er dabei im Wasser, bekommt der Besitzer den Strafschlag.
- Windmühle: Die Flügel prallen den Ball ab.
- Schiebetor: fährt hin und her, Timing entscheidet.
- Teleporter-Röhren: Ball verschwindet in einer Röhre und kommt an der gleichen Farbe wieder heraus, in derselben Richtung.
- Maximal 8 Schläge pro Bahn, danach wird der Ball automatisch eingelocht.

## Bedienung

Aufs Feld tippen und nach hinten ziehen (wie ein Katapult), dann "Schlag". Länge des Zugs = Kraft.

## Bahnen

1 Aufwärmen, 2 Schikane, 3 Windmühle, 4 Röhrenpost, 5 Schiebetor, 6 Doppeltor, 7 Röhrenlabyrinth, 8 Tor und Mühle, 9 Finale. Die Bahnen stehen in `public/shared.js` und lassen sich dort leicht ändern.

Bahn-Vorschau im Browser: `http://localhost:3020/?preview=5`

## Dateien

- `server.js`: Server, Spielregeln, Speicherung
- `public/shared.js`: Physik und Bahnen (von Server und Browser genutzt)
- `public/app.js`, `public/index.html`: Oberfläche und Grafik

## Telegram-Benachrichtigung (optional)

1. In Telegram `@BotFather` anschreiben, `/newbot`, Namen vergeben. Den **Token** kopieren.
2. In Railway beim Dienst unter **Variables**: `TELEGRAM_BOT_TOKEN` = der Token.
3. Im Spiel erscheint unten der Knopf **Telegram**. Antippen, in Telegram auf **Start** drücken. Danach kommt eine Nachricht, sobald man dran ist.

Hinweis: Dafür einen **neuen** Bot nehmen, nicht den von Drawly.
