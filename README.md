# Dekoder Interlinearny — Metoda Birkenbihl

Aplikacja Astro do nauki angielskiego przez dekodowanie słowo po słowie. Interfejs pozostaje statycznym HTML z lekkimi modułami TypeScript, a dekodowanie Gemini działa wyłącznie w endpointcie serwerowym.

Aktywnym źródłem aplikacji jest `src/`; dotychczasowy plik `dekoder_interlinearny_metoda_birkenbihl.html` pozostaje bez zmian jako archiwalny prototyp.

## Wymagania

- Node.js `>=22.23.4`
- Klucz Gemini ustawiony jako sekret środowiska uruchomieniowego (nigdy w kodzie przeglądarki)

## Uruchomienie lokalne

```sh
npm ci
npm run dev
```

Żądanie do `/api/decode` potrzebuje `GEMINI_API_KEY`. Lokalnie umieść go w ignorowanym przez Git pliku `.dev.vars`; wdrożony Worker powinien korzystać z sekretu:

```sh
printf 'GEMINI_API_KEY=tu-wklej-klucz\n' > .dev.vars
npx wrangler secret put GEMINI_API_KEY
npm run deploy
```

Domyślnie używany jest `gemini-3.5-flash-lite` z minimalnym poziomem „thinking”: Google opisuje go jako najszybszy i najtańszy model do zadań o dużej liczbie żądań; obsługuje Structured Outputs. Błędy przejściowe HTTP (m.in. 503) są ponawiane maksymalnie dwa razy z rosnącym opóźnieniem. Pojedyncze żądanie ma limit 45 sekund; timeout kończy się czytelnym błędem bez ponawiania. Model można opcjonalnie zmienić przez `GEMINI_MODEL`, podając identyfikator dostępny dla danego klucza. Limit endpointu jest skonfigurowany w `wrangler.jsonc` i ogranicza dekodowanie do 10 żądań na minutę z adresu klienta. Limit Cloudflare jest przybliżony i liczony osobno w lokalizacjach Cloudflare.

## Funkcje

- Import i przeciąganie plików `.md`, `.markdown` i `.txt`, pole Markdown, przykład oraz trzy tryby nauki.
- Głosy Web Speech API `en-GB`/`en-US`, tempo 0.6–1.2, odtwarzanie tokenu, zdania i całego tekstu.
- Tłumaczenie naturalne na żądanie, glosy gramatyczne, eksport Markdown `<ruby>` i samodzielny HTML bez zasobów zewnętrznych.
- Ostatnie 10 lekcji w `localStorage`; cache jest wersjonowany, walidowany i pozostaje na danym urządzeniu.

Tekst wysłany do dekodowania trafia do Gemini. Nie wklejaj do aplikacji treści poufnych. Wyniki modelu są walidowane i niepoprawne odpowiedzi nie są pokazywane jako poprawne tłumaczenia.

## Obsługiwany Markdown

Obsługiwane są nagłówki, akapity oraz elementy list. Cytaty, tabele, bloki kodu i inne bloki Markdown są jawnie odrzucane — nie są po cichu pomijane. Formatowanie inline (np. linki i kursywa) jest dekodowane jako widoczny tekst bez zachowania stylu ani adresu linku. Kontrakt obecnie nie zachowuje numeracji, typu ani zagnieżdżenia list; zachowuje kolejność elementów.

## Jakość

```sh
npm run check
npm test
npm run build
npm run test:e2e
```

Testy E2E mockują endpoint Gemini, więc nie potrzebują prawdziwego klucza ani nie zużywają tokenów.