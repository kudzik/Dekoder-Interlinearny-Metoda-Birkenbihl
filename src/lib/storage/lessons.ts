import { z } from "zod";
import { DecodedDocumentSchema, type DecodedDocument } from "../decode/schema";

const STORAGE_KEY = "birkenbihl-lessons-v1";
const MAX_SAVED_LESSONS = 10;
const MAX_STORAGE_CHARACTERS = 1_000_000;

const LessonSchema = z.object({
  markdown: z.string(),
  decoded: DecodedDocumentSchema,
  savedAt: z.number(),
});

type Lesson = z.infer<typeof LessonSchema>;

function readLessons(): Lesson[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) {
      console.warn("Zapisane lekcje mają nieprawidłowy format i zostały pominięte.");
      return [];
    }
    return data.flatMap((item) => {
      const parsed = LessonSchema.safeParse(item);
      if (!parsed.success) console.warn("Pominięto nieprawidłowy wpis zapisanej lekcji.");
      return parsed.success ? [parsed.data] : [];
    });
  } catch (error) {
    console.warn("Nie udało się odczytać zapisanych lekcji.", error);
    return [];
  }
}

function writeLessons(lessons: Lesson[]): boolean {
  try {
    const stored = lessons.slice(0, MAX_SAVED_LESSONS);
    while (stored.length > 0 && JSON.stringify(stored).length > MAX_STORAGE_CHARACTERS) stored.pop();
    if (stored.length === 0 && lessons.length > 0) {
      console.warn("Lekcja przekracza limit pamięci lokalnej i nie została zapisana.");
      return false;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    return true;
  } catch (error) {
    console.warn("Lekcja nie została zapisana w pamięci przeglądarki.", error);
    return false;
  }
}

export function findSavedLesson(markdown: string): DecodedDocument | null {
  return readLessons().find((lesson) => lesson.markdown === markdown)?.decoded ?? null;
}

export function getMostRecentLesson(): { markdown: string; decoded: DecodedDocument } | null {
  const [lesson] = readLessons();
  return lesson ? { markdown: lesson.markdown, decoded: lesson.decoded } : null;
}

export function saveLesson(markdown: string, decoded: DecodedDocument): boolean {
  const checked = DecodedDocumentSchema.safeParse(decoded);
  if (!checked.success) {
    console.error("Nie zapisano lekcji, która nie spełnia kontraktu dekodowania.");
    return false;
  }
  const lessons = readLessons().filter((lesson) => lesson.markdown !== markdown);
  lessons.unshift({ markdown, decoded: checked.data, savedAt: Date.now() });
  return writeLessons(lessons);
}
