/**
 * Database access module
 */

import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import type { BibleReference } from "../utils/referenceUtils.js";
import { referenceToDbId } from "../utils/referenceUtils.js";

// Default database path - use path relative to the project root
const DEFAULT_DB_PATH = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../bible.db');

let db: any = null;

/**
 * Initialize the database connection
 * @param dbPath Path to the SQLite database file
 */
export function initDatabase(dbPath: string = DEFAULT_DB_PATH): void {
  if (db) return; // Already initialized

  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `Database file not found: ${dbPath}. Run 'node scripts/create-db.js' to create it.`,
    );
  }

  db = new Database(dbPath, { readonly: true });
  db.pragma("journal_mode = WAL");
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Assembles text from tokens using proper spacing and punctuation
 * @param tokens Array of token objects with text and spacing flags
 * @returns Assembled text with proper formatting
 */
function assembleTextFromTokens(
  tokens: Array<{ text: string; skip_space_after: number | boolean }>,
): string {
  return tokens.reduce((text, token, index) => {
    const tokenText = token.text;
    // Determine if we should add a space after this token
    // Convert skip_space_after to boolean (it might be 0/1 from SQLite)
    const skipSpace = !!token.skip_space_after;
    const space = skipSpace ? "" : " ";

    // Only add space if this isn't the last token
    return text + tokenText + (index < tokens.length - 1 ? space : "");
  }, "");
}

/**
 * Get English text for a verse reference
 * @param reference The verse reference
 * @returns The English text for the reference, or null if not found
 */
export function getEnglishText(reference: BibleReference): string | null {
  if (!db) initDatabase();

  const { bookId, chapter, verse } = reference;

  if (!bookId || !chapter || !verse) {
    return null;
  }

  const tokens = db
    .prepare(
      `
    SELECT text, skip_space_after
    FROM english_tokens
    WHERE book_num = ? AND chapter = ? AND verse = ? 
    ORDER BY word_position
  `,
    )
    .all(bookId, chapter, verse);

  if (!tokens || tokens.length === 0) {
    return null;
  }

  console.log(tokens);
  return assembleTextFromTokens(tokens);
}

/**
 * Get a range of English verses
 * @param reference The verse reference (with optional endVerse)
 * @returns Array of verse objects with text and reference info
 */
export function getPassage(reference: BibleReference): Array<{
  text: string;
  verse: number;
  reference: string;
}> {
  if (!db) initDatabase();

  const { bookId, book, chapter } = reference;
  const startVerse = reference.verse || 1;
  const endVerse = reference.endVerse || startVerse;

  // First get the distinct verses in range
  const verses = db
    .prepare(
      `
    SELECT DISTINCT verse
    FROM english_tokens
    WHERE book_num = ? AND chapter = ? AND verse >= ? AND verse <= ?
    ORDER BY verse
  `,
    )
    .all(bookId, chapter, startVerse, endVerse);

  // Then assemble each verse from tokens
  return verses.map((verseRow: { verse: number }) => {
    const verseReference = `${book} ${chapter}:${verseRow.verse}`;

    // Get tokens for this verse
    const tokens = db
      .prepare(
        `
      SELECT text, skip_space_after
      FROM english_tokens
      WHERE book_num = ? AND chapter = ? AND verse = ? AND exclude = 0
      ORDER BY word_position
    `,
      )
      .all(bookId, chapter, verseRow.verse);

    return {
      text: assembleTextFromTokens(tokens),
      verse: verseRow.verse,
      reference: verseReference,
    };
  });
}

/**
 * Get original Hebrew text for a verse reference
 * @param reference The verse reference
 * @returns Array of Hebrew word objects
 */
export function getHebrewText(reference: BibleReference): Array<{
  text: string;
  transliteration: string;
  wordPosition: number;
  lemma: string;
  strongNumber: string;
  skip_space_after: boolean;
}> {
  if (!db) initDatabase();

  const results = db
    .prepare(
      `
    SELECT 
      text, 
      transliteration, 
      word_position as wordPosition, 
      lemma, 
      strong_number as strongNumber,
      skip_space_after
    FROM hebrew_tokens
    WHERE book_num = ? AND chapter = ? AND verse = ?
    ORDER BY word_position
  `,
    )
    .all(reference.bookId, reference.chapter, reference.verse);

  return results;
}

/**
 * Get assembled Hebrew text for a verse
 * @param reference The verse reference
 * @returns Assembled Hebrew text or null if not found
 */
export function getAssembledHebrewText(
  reference: BibleReference,
): string | null {
  if (!db) initDatabase();

  const tokens = getHebrewText(reference);

  if (!tokens || tokens.length === 0) {
    return null;
  }

  return assembleTextFromTokens(tokens);
}

/**
 * Get original Greek text for a verse reference
 * @param reference The verse reference
 * @returns Array of Greek word objects
 */
export function getGreekText(reference: BibleReference): Array<{
  text: string;
  wordPosition: number;
  lemma: string;
  strong: string;
  morph: string;
  skip_space_after: boolean;
}> {
  if (!db) initDatabase();

  const results = db
    .prepare(
      `
    SELECT 
      text, 
      word_position as wordPosition, 
      lemma, 
      strong, 
      morph,
      skip_space_after
    FROM greek_tokens
    WHERE book_num = ? AND chapter = ? AND verse = ?
    ORDER BY word_position
  `,
    )
    .all(reference.bookId, reference.chapter, reference.verse);

  return results;
}

/**
 * Get assembled Greek text for a verse
 * @param reference The verse reference
 * @returns Assembled Greek text or null if not found
 */
export function getAssembledGreekText(
  reference: BibleReference,
): string | null {
  if (!db) initDatabase();

  const tokens = getGreekText(reference);

  if (!tokens || tokens.length === 0) {
    return null;
  }

  return assembleTextFromTokens(tokens);
}

/**
 * Search for English text in the Bible
 * @param query The search query
 * @param testament Optional testament filter ('OT' or 'NT')
 * @param book Optional book filter (book number)
 * @param limit Maximum number of results to return
 * @returns Array of verse objects matching the search
 */
export function searchText(
  query: string,
  testament?: string,
  book?: string,
  limit: number = 20,
): Array<{
  text: string;
  reference: string;
  book: string;
  chapter: number;
  verse: number;
}> {
  if (!db) initDatabase();

  // Build query conditions
  const conditions = ["text LIKE ?"];
  const params = [`%${query}%`];

  if (testament) {
    if (testament === "OT") {
      conditions.push("CAST(book_num AS INTEGER) <= 39");
    } else if (testament === "NT") {
      conditions.push("CAST(book_num AS INTEGER) >= 40");
    }
  }

  if (book) {
    conditions.push("book_num = ?");
    params.push(String(book));
  }

  // First, find all distinct verses that contain the search term
  const findVersesSql = `
    SELECT DISTINCT book_num, book_name, chapter, verse
    FROM english_tokens
    WHERE ${conditions.join(" AND ")} AND exclude = 0
    ORDER BY book_num, chapter, verse
    LIMIT ?
  `;

  params.push(String(limit));

  const matchingVerses = db.prepare(findVersesSql).all(...params);

  // Now for each matching verse, get all tokens and assemble the text
  return matchingVerses.map((verse: any) => {
    const tokens = db
      .prepare(
        `
      SELECT text, skip_space_after
      FROM english_tokens
      WHERE book_num = ? AND chapter = ? AND verse = ? AND exclude = 0
      ORDER BY word_position
    `,
      )
      .all(verse.book_num, verse.chapter, verse.verse);

    const assembledText = assembleTextFromTokens(tokens);

    return {
      text: assembledText,
      reference: `${verse.book_name} ${verse.chapter}:${verse.verse}`,
      book: verse.book_name,
      chapter: verse.chapter,
      verse: verse.verse,
    };
  });
}

export default {
  initDatabase,
  closeDatabase,
  getEnglishText,
  getPassage,
  getHebrewText,
  getGreekText,
  getAssembledHebrewText,
  getAssembledGreekText,
  searchText,
};
