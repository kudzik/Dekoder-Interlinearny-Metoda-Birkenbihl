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

Żądania do `/api/decode` i `/api/speech` potrzebują `GEMINI_API_KEY`. Lokalnie umieść go w ignorowanym przez Git pliku `.dev.vars`; wdrożony Worker powinien korzystać z sekretu:

```sh
printf 'GEMINI_API_KEY=tu-wklej-klucz\n' > .dev.vars
npx wrangler secret put GEMINI_API_KEY
npm run deploy
```

Domyślnie używany jest `gemini-3.5-flash-lite` z minimalnym poziomem „thinking”: Google opisuje go jako najszybszy i najtańszy model do zadań o dużej liczbie żądań; obsługuje Structured Outputs. Błędy przejściowe HTTP (m.in. 503) są ponawiane maksymalnie dwa razy z rosnącym opóźnieniem. Pojedyncze żądanie ma limit 45 sekund; timeout kończy się czytelnym błędem bez ponawiania. Model można opcjonalnie zmienić przez `GEMINI_MODEL`, podając identyfikator dostępny dla danego klucza. Limit endpointu jest skonfigurowany w `wrangler.jsonc` i ogranicza dekodowanie do 10 żądań na minutę z adresu klienta. Limit Cloudflare jest przybliżony i liczony osobno w lokalizacjach Cloudflare.

## Funkcje

- Import i przeciąganie plików `.md`, `.markdown` i `.txt`, pole Markdown, gotowa próbka dostępna bez API oraz trzy tryby nauki.
- Gemini TTS z wyborem brytyjskiego lub amerykańskiego akcentu oraz systemowe głosy angielskie przeglądarki. Oba warianty obsługują tempo 0.6–1.2 i odtwarzanie tokenu, zdania, fragmentu i całego tekstu; głosy systemowe są szybsze i działają lokalnie. Eksport HTML pozostaje offline i korzysta z głosów systemowych.
- Tłumaczenie naturalne na żądanie, glosy gramatyczne, eksport Markdown `<ruby>` i samodzielny HTML bez zasobów zewnętrznych.
- Ostatnie 10 lekcji w `localStorage`; cache jest wersjonowany, walidowany i pozostaje na danym urządzeniu.

### Głosy i prywatność

Gemini TTS wysyła tekst wybranego tokenu, zdania lub fragmentu do Gemini; pełne czytanie wysyła tekst kolejno zdanie po zdaniu. Odtworzone audio jest buforowane tylko w pamięci karty (do 32 ostatnich pozycji). Endpoint ma osobny limit 60 żądań na minutę z adresu klienta. Głos systemowy nie wysyła tekstu do serwera i zwykle zaczyna czytać szybciej.

Lista głosów systemowych pochodzi z przeglądarki i systemu operacyjnego. Jeśli nie ma w niej głosu z językiem `en-*`, aplikacja wyłącza tę opcję zamiast użyć głosu polskiego do czytania angielskiego. Zainstaluj angielski głos w ustawieniach systemu i odśwież stronę. Przycisk czytania fragmentu/zdania odtwarza dany zakres, a „Czytaj całość” odtwarza zdania po kolei; zatrzymanie przerywa bieżący dźwięk lub żądanie.

Tekst wysłany do dekodowania również trafia do Gemini. Nie wklejaj do aplikacji treści poufnych. Wyniki modelu są walidowane, a błędne odpowiedzi nie są pokazywane jako poprawne tłumaczenia. Gotowa próbka jest statycznym przykładem, nie wynikiem świeżego żądania. Aplikacja nie używa automatycznego „awaryjnego tłumacza” — takie podstawienia mogłyby wyglądać jak poprawne glosy.

### Obsługa i dostępność

- Układ dopasowuje się do telefonów, tabletów i dużych ekranów; przyciski mają widoczny fokus klawiatury, a interfejs respektuje ustawienie ograniczenia animacji.
- W trybie testu glosa pozostaje ukryta również w nazwie dostępności tokenu, dopóki użytkownik jej nie odkryje. Kliknięcie/klawiatura działa także na urządzeniach bez hovera.
- Motyw, tryby nauki, naturalne tłumaczenie i eksport są dostępne z klawiatury. W przeglądarce bez głosów systemowych nadal można używać Gemini TTS.

## Obsługiwany Markdown

Obsługiwane są nagłówki, akapity oraz elementy list. Cytaty, tabele, bloki kodu i inne bloki Markdown są jawnie odrzucane — nie są po cichu pomijane. Formatowanie inline (np. linki i kursywa) jest dekodowane jako widoczny tekst bez zachowania stylu ani adresu linku. Kontrakt obecnie nie zachowuje numeracji, typu ani zagnieżdżenia list; zachowuje kolejność elementów.

## Jakość

```sh
npm run check
npm test
npm run build
npm run test:e2e
```

Testy E2E uruchamiają interfejs w Chromium, mockują endpointy AI i głosy systemowe, więc nie potrzebują prawdziwego klucza ani nie zużywają tokenów. Sprawdzają dekodowanie i cache, oba eksporty, Gemini oraz lokalne odtwarzanie, komunikaty błędów, tryby pomocy/motywu, fokus klawiatury, dotykowe odkrywanie glos i brak poziomego przewijania przy szerokościach 320, 360, 390, 768, 1024 i 1440 px.