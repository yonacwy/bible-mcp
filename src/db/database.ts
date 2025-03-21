/**
 * Database access module
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import type { BibleReference } from '../utils/referenceUtils.js';
import { referenceToDbId } from '../utils/referenceUtils.js';

// Default database path
const DEFAULT_DB_PATH = path.join(process.cwd(), 'bible.db');

let db: any = null;

/**
 * Initialize the database connection
 * @param dbPath Path to the SQLite database file
 */
export function initDatabase(dbPath: string = DEFAULT_DB_PATH): void {
  if (db) return; // Already initialized
  
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database file not found: ${dbPath}. Run 'node scripts/create-db.js' to create it.`);
  }
  
  db = new Database(dbPath, { readonly: true });
  db.pragma('journal_mode = WAL');
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
 * Get English text for a verse reference
 * @param reference The verse reference
 * @returns The English text for the reference, or null if not found
 */
export function getEnglishText(reference: BibleReference): string | null {
  if (!db) initDatabase();
  
  const verseId = referenceToDbId(reference, 'bsb_english');
  
  const result = db.prepare(`
    SELECT text
    FROM bsb_english
    WHERE id = ?
  `).get(verseId);
  
  return result ? result.text : null;
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
  
  const startVerse = reference.verse || 1;
  const endVerse = reference.endVerse || startVerse;
  
  const results = db.prepare(`
    SELECT text, verse, verse_ref
    FROM bsb_english
    WHERE book_num = ? AND chapter = ? AND verse >= ? AND verse <= ?
    ORDER BY verse
  `).all(reference.bookId, reference.chapter, startVerse, endVerse);
  
  return results.map((row: any) => ({
    text: row.text,
    verse: row.verse,
    reference: row.verse_ref
  }));
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
}> {
  if (!db) initDatabase();
  
  const results = db.prepare(`
    SELECT 
      text, 
      transliteration, 
      word_position as wordPosition, 
      lemma, 
      strong_number as strongNumber
    FROM hebrew_ot
    WHERE book_num = ? AND chapter = ? AND verse = ?
    ORDER BY word_position
  `).all(reference.bookId, reference.chapter, reference.verse);
  
  return results;
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
}> {
  if (!db) initDatabase();
  
  const results = db.prepare(`
    SELECT 
      text, 
      word_position as wordPosition, 
      lemma, 
      strong, 
      morph
    FROM greek_nt
    WHERE book_num = ? AND chapter = ? AND verse = ?
    ORDER BY word_position
  `).all(reference.bookId, reference.chapter, reference.verse);
  
  return results;
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
  limit: number = 20
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
    if (testament === 'OT') {
      conditions.push("CAST(book_num AS INTEGER) <= 39");
    } else if (testament === 'NT') {
      conditions.push("CAST(book_num AS INTEGER) >= 40");
    }
  }
  
  if (book) {
    conditions.push("book_num = ?");
    params.push(String(book));
  }
  
  // Execute search query
  const sql = `
    SELECT 
      text, 
      verse_ref as reference, 
      book_name as book, 
      chapter, 
      verse
    FROM bsb_english
    WHERE ${conditions.join(' AND ')}
    ORDER BY book_num, chapter, verse
    LIMIT ?
  `;
  
  params.push(String(limit));
  
  return db.prepare(sql).all(...params);
}

export default {
  initDatabase,
  closeDatabase,
  getEnglishText,
  getPassage,
  getHebrewText,
  getGreekText,
  searchText
};