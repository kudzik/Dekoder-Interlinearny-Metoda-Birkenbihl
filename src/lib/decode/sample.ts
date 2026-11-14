import type { DecodedDocument } from "./schema";

export const SAMPLE_MARKDOWN = `# A Morning Routine That Changed My Life

For years, I used to put off waking up early. Whenever my alarm went off, I would hit the snooze button and stay in bed.

## Turning Over a New Leaf

Last month, I decided to give up this bad habit. At first, getting out of bed at six o'clock was not a piece of cake, but I kept going. Now, I look forward to my quiet mornings with a cup of coffee before the rest of the city wakes up.`;

export const SAMPLE_DECODED_DOCUMENT: DecodedDocument = {
  blocks: [
    {
      type: "heading",
      level: 1,
      sentences: [
        {
          id: "1-1",
          natural_pl: "Poranna rutyna, która zmieniła moje życie.",
          tokens: [
            { en: "A", pl_literal: "(przedimek)", grammar: "Przedimek nieokreślony", is_chunk: false },
            { en: "Morning", pl_literal: "poranna", grammar: "Rzeczownik w funkcji przymiotnika", is_chunk: false },
            { en: "Routine", pl_literal: "rutyna", grammar: "Rzeczownik", is_chunk: false },
            { en: "That", pl_literal: "która", grammar: "Zaimek względny", is_chunk: false },
            { en: "Changed", pl_literal: "zmieniła", grammar: "Past Simple", is_chunk: false },
            { en: "My", pl_literal: "moje", grammar: "Zaimek dzierżawczy", is_chunk: false },
            { en: "Life", pl_literal: "życie", grammar: "Rzeczownik", is_chunk: false },
          ],
        },
      ],
    },
    {
      type: "paragraph",
      sentences: [
        {
          id: "2-1",
          natural_pl: "Przez lata miałem w zwyczaju odkładać wczesne wstawanie.",
          tokens: [
            { en: "For years,", pl_literal: "przez lata,", grammar: "Określenie czasu", is_chunk: true },
            { en: "I", pl_literal: "ja", grammar: "Zaimek osobowy", is_chunk: false },
            { en: "used to", pl_literal: "miałem w zwyczaju", grammar: "Dawny nawyk", is_chunk: true },
            { en: "put off", pl_literal: "odkładać na później", grammar: "Phrasal verb", is_chunk: true },
            { en: "waking up", pl_literal: "budzenie się", grammar: "Gerund", is_chunk: true },
            { en: "early.", pl_literal: "wcześnie.", grammar: "Przysłówek", is_chunk: false },
          ],
        },
        {
          id: "2-2",
          natural_pl: "Ilekroć dzwonił mój budzik, wciskałem przycisk drzemki i zostawałem w łóżku.",
          tokens: [
            { en: "Whenever", pl_literal: "ilekroć", grammar: "Spójnik", is_chunk: false },
            { en: "my", pl_literal: "mój", grammar: "Zaimek dzierżawczy", is_chunk: false },
            { en: "alarm", pl_literal: "budzik", grammar: "Rzeczownik", is_chunk: false },
            { en: "went off,", pl_literal: "zadzwonił,", grammar: "Phrasal verb w czasie przeszłym", is_chunk: true },
            { en: "I", pl_literal: "ja", grammar: "Zaimek osobowy", is_chunk: false },
            { en: "would", pl_literal: "zwykłem", grammar: "Nawyk w przeszłości", is_chunk: false },
            { en: "hit", pl_literal: "wciskać", grammar: "Czasownik", is_chunk: false },
            { en: "the", pl_literal: "(ten)", grammar: "Przedimek określony", is_chunk: false },
            { en: "snooze button", pl_literal: "przycisk drzemki", grammar: "Rzeczownik złożony", is_chunk: true },
            { en: "and", pl_literal: "i", grammar: "Spójnik", is_chunk: false },
            { en: "stay", pl_literal: "zostawać", grammar: "Czasownik", is_chunk: false },
            { en: "in bed.", pl_literal: "w łóżku.", grammar: "Wyrażenie przyimkowe", is_chunk: true },
          ],
        },
      ],
    },
    {
      type: "heading",
      level: 2,
      sentences: [
        {
          id: "3-1",
          natural_pl: "Zaczynając nowy rozdział.",
          tokens: [
            {
              en: "Turning Over a New Leaf",
              pl_literal: "przewracając nowy liść (zaczynając od nowa)",
              grammar: "Idiom",
              is_chunk: true,
            },
          ],
        },
      ],
    },
    {
      type: "paragraph",
      sentences: [
        {
          id: "4-1",
          natural_pl: "W zeszłym miesiącu postanowiłem rzucić ten zły nawyk.",
          tokens: [
            { en: "Last month,", pl_literal: "zeszłego miesiąca,", grammar: "Określenie czasu", is_chunk: true },
            { en: "I", pl_literal: "ja", grammar: "Zaimek osobowy", is_chunk: false },
            { en: "decided", pl_literal: "zdecydowałem", grammar: "Past Simple", is_chunk: false },
            { en: "to", pl_literal: "aby", grammar: "Bezokolicznik", is_chunk: false },
            { en: "give up", pl_literal: "rzucić", grammar: "Phrasal verb", is_chunk: true },
            { en: "this", pl_literal: "ten", grammar: "Zaimek wskazujący", is_chunk: false },
            { en: "bad", pl_literal: "zły", grammar: "Przymiotnik", is_chunk: false },
            { en: "habit.", pl_literal: "nawyk.", grammar: "Rzeczownik", is_chunk: false },
          ],
        },
        {
          id: "4-2",
          natural_pl: "Na początku wyjście z łóżka o szóstej nie było bułką z masłem, ale szedłem dalej.",
          tokens: [
            { en: "At first,", pl_literal: "na początku,", grammar: "Wyrażenie przysłówkowe", is_chunk: true },
            { en: "getting out of", pl_literal: "wydostawanie się z", grammar: "Gerund + phrasal verb", is_chunk: true },
            { en: "bed", pl_literal: "łóżka", grammar: "Rzeczownik", is_chunk: false },
            { en: "at six o'clock", pl_literal: "o szóstej godzinie", grammar: "Określenie czasu", is_chunk: true },
            { en: "was not", pl_literal: "nie było", grammar: "Przeczenie w czasie przeszłym", is_chunk: true },
            { en: "a piece of cake,", pl_literal: "kawałkiem ciasta (bułką z masłem),", grammar: "Idiom", is_chunk: true },
            { en: "but", pl_literal: "ale", grammar: "Spójnik", is_chunk: false },
            { en: "I", pl_literal: "ja", grammar: "Zaimek osobowy", is_chunk: false },
            { en: "kept going.", pl_literal: "kontynuowałem.", grammar: "Phrasal verb", is_chunk: true },
          ],
        },
        {
          id: "4-3",
          natural_pl: "Teraz nie mogę się doczekać cichych poranków z kawą, zanim reszta miasta się obudzi.",
          tokens: [
            { en: "Now,", pl_literal: "teraz,", grammar: "Przysłówek czasu", is_chunk: false },
            { en: "I", pl_literal: "ja", grammar: "Zaimek osobowy", is_chunk: false },
            { en: "look forward to", pl_literal: "patrzę w przód do", grammar: "Phrasal verb", is_chunk: true },
            { en: "my", pl_literal: "moich", grammar: "Zaimek dzierżawczy", is_chunk: false },
            { en: "quiet", pl_literal: "cichych", grammar: "Przymiotnik", is_chunk: false },
            { en: "mornings", pl_literal: "poranków", grammar: "Rzeczownik w liczbie mnogiej", is_chunk: false },
            { en: "with", pl_literal: "z", grammar: "Przyimek", is_chunk: false },
            { en: "a cup of", pl_literal: "filiżanką", grammar: "Określenie ilości", is_chunk: true },
            { en: "coffee", pl_literal: "kawy", grammar: "Rzeczownik niepoliczalny", is_chunk: false },
            { en: "before", pl_literal: "zanim", grammar: "Spójnik czasowy", is_chunk: false },
            { en: "the rest of", pl_literal: "reszta", grammar: "Wyrażenie rzeczownikowe", is_chunk: true },
            { en: "the city", pl_literal: "tego miasta", grammar: "Rzeczownik", is_chunk: true },
            { en: "wakes up.", pl_literal: "budzi się.", grammar: "Phrasal verb", is_chunk: true },
          ],
        },
      ],
    },
  ],
};
