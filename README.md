# Murdoku Planer

Komplett mit Claude gebaut. 

Eine kleine statische Seite, um Murdoku-Rätsel nachzubauen und zu lösen, ohne ins Buch zu schreiben.
Kein Build, keine Abhängigkeiten – nur `index.html`, `styles.css`, `app.js`.

## Funktionen

* **Freies Raster** von 6×6 bis 12×12 (Spalten und Zeilen getrennt einstellbar).
* **Personen**: ein Opfer plus beliebig viele Verdächtige (1–12), mit eigenem Namen und eigener Farbe.
* **Wände und Fenster**: Klick auf eine Kante schaltet `Wand → Fenster → keine Wand`. Außenwände sind
  voreingestellt und lassen sich per Knopf wiederherstellen.
* **Blocker** (nicht belegbar): Tisch, Pflanze, Fernseher, Regal, Statue.
* **Belegbare Blocker**: Bett, Stuhl, Teppich – Sicht blockiert, Feld bleibt besetzbar.
* **Drei Modi**
  * **Layout** – Raster, Wände, Fenster, Möbel, Personen und Position des Opfers festlegen.
  * **Notizen** – Kandidaten und Ausschlüsse pro Person eintragen, Felder mit `✕` als leer markieren.
  * **Lösung** – Personen endgültig setzen. Jede festgelegte Lösung **graut die komplette Reihe und
    Spalte aus**; eine zweite Person in derselben Reihe/Spalte wird abgewiesen (Regel abschaltbar).
* **„Der Mord wurde begangen von …“** als Auswahlfeld, wie auf der Buchseite.
* **Speichern**: automatisch im Browser, dazu benannte Rätsel im Browserspeicher sowie Export/Import als JSON.
* **Drucken**: `Drucken` erzeugt eine saubere Seite (Querformat A4) ohne Bedienelemente.
* Undo/Redo, Hell-/Dunkelmodus, Tastatur und Touch.

## Bedienung

| Aktion | Maus | Touch |
| --- | --- | --- |
| Wand setzen / Fenster / löschen | Klick auf die Kante (Rechtsklick löscht sofort) | Tippen auf die Kante |
| Möbel setzen / entfernen | Werkzeug wählen, Feld klicken (erneut = weg) | genauso |
| Kandidat / Ausschluss | Person wählen, Feld klicken; Rechtsklick = Ausschluss | Werkzeug `Ausschluss` wählen |
| Lösung setzen / entfernen | Person wählen, Feld klicken; Rechtsklick entfernt | Werkzeug `Entfernen` |

Tastatur: `1`–`9` wählt eine verdächtige Person, `0` das Opfer, `L`/`N`/`S` wechselt den Modus,
`Strg+Z` / `Strg+Y` macht rückgängig bzw. wieder her.

## Lokal starten

```sh
python3 -m http.server 8000   # danach http://localhost:8000 öffnen
```

Ein direkt geöffnetes `index.html` (`file://`) funktioniert ebenfalls.

## Auf GitHub Pages veröffentlichen

Zwei Wege – einer reicht:

1. **Actions** (im Repo enthalten): *Settings → Pages → Source: GitHub Actions*. Jeder Push auf `main`
   veröffentlicht über `.github/workflows/pages.yml`.
2. **Branch**: *Settings → Pages → Source: Deploy from a branch*, Branch `main`, Ordner `/ (root)`.

Die Seite liegt danach unter `https://<benutzer>.github.io/murdoku/`.
