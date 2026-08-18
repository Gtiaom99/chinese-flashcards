# Cinese in viaggio — Flashcard

Webapp locale e **gratis** per studiare frasi di viaggio:

- **Italiano** / **Cinese** / **Pinyin**
- **Tocca una parola** per vederne il significato (come HelloChinese)
- **Audio** con la sintesi vocale del browser (nessuna API a pagamento)
- Ripasso semplice tipo Anki (Di nuovo / Difficile / Bene / Facile)
- Progressi salvati in `localStorage` (solo su questo browser)

## Usa dal telefono (online)

**App live (GitHub Pages):**  
https://gtiaom99.github.io/chinese-flashcards/

Apri il link in Chrome (Android) o Safari (iPhone).

### Installa sul telefono (icona home)

Icona app: carattere **汉** su sfondo scuro (PWA).

- **Android (Chrome):** menu ⋮ → **Installa app** / **Aggiungi a Home**
- **iPhone (Safari):** Condividi → **Aggiungi a Home**

Dopo l’installazione vedrai l’icona “Cinese” con il carattere 汉.

## Repository GitHub

- Repo: https://github.com/Gtiaom99/chinese-flashcards  
- Download ZIP: https://github.com/Gtiaom99/chinese-flashcards/archive/refs/heads/main.zip  

## Come aprirla in locale

1. Scarica o clona il repo
2. Apri `index.html`  
   oppure, da terminale nella cartella:

```bash
# Python
python -m http.server 8080
```

Poi vai su `http://localhost:8080`

**Consigliato:** Chrome o Edge (migliori voci TTS su Windows).

## Audio: come funziona (senza Google a pagamento)

L’app usa la **Web Speech API** (`speechSynthesis`) del browser:

- Gratis
- Nessuna chiave API
- Nessun account
- Funziona offline dopo che le voci del sistema sono disponibili

### Google Translate / Cloud TTS?

| Opzione | Costo | Note |
|--------|-------|------|
| **Web Speech API** (questa app) | Gratis | Ideale per uso personale |
| **Google Cloud Text-to-Speech** | A pagamento (con free tier limitato) | Serve progetto Google Cloud + chiave API + carta |
| **URL non ufficiali di Google Translate TTS** | Tecnicamente “gratis” | Instabili, rate-limit, non adatti a un’app seria |
| **Azure / Amazon Polly** | A pagamento | Stesso discorso: chiave API |

Per 15 minuti al giorno e frasi di viaggio, la voce del browser basta.

### Se non senti il cinese su Windows

1. **Impostazioni** → **Ora e lingua** → **Voce** (o “Speech”)
2. Aggiungi una voce **Cinese (Mandarino, semplificato)** / Chinese (Mainland)
3. Riapri l’app → scheda **Audio** → **Ricarica voci** → **Prova audio**

Su telefono (Chrome Android / Safari iOS) di solito le voci cinesi ci sono già.

## Uso rapido (15 min)

1. Scheda **Studia**
2. Leggi l’italiano, prova a dirlo in cinese
3. Tocca la carta (o “Mostra risposta”)
4. Premi **Ascolta** / **Lento** e ripeti ad alta voce
5. Tocca una parola cinese: sotto compare il significato di quella parola
6. Valuta la carta

Scorciatoie tastiera:

- `Spazio` — mostra risposta + audio
- `A` — ascolta
- `S` — ascolta lento
- `1` `2` `3` `4` — Di nuovo / Difficile / Bene / Facile

## File

- `index.html` — interfaccia
- `styles.css` — stile
- `cards.js` — mazzo frasi (puoi aggiungere righe)
- `app.js` — logica studio + audio

## Aggiungere frasi

In `cards.js`, aggiungi oggetti così:

```js
{ id: "x99", cat: "cibo", it: "Acqua frizzante", zh: "气泡水", py: "qìpào shuǐ",
  words: [w("气泡水", "qìpào shuǐ", "acqua frizzante")] },
```

`w(cinese, pinyin, italiano)` è definito in cima a `cards.js`. Per la punteggiatura usa `p("？")`.

Poi ricarica la pagina.
