/**
 * Bible Reference Utilities
 * 
 * Provides utilities for parsing and handling Bible verse references
 * in various formats.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the Bible lookup data
const bibleData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../BibleLookup.json'), 'utf8')
);

// Map of book numbers to book data for quick lookup
const bookNumberMap = new Map();
// Map of book names and abbreviations to book data for quick lookup
const bookNameMap = new Map();

// Book pattern for regex matching
const bookPatterns: string[] = [];

// Initialize lookup maps from the Bible data
for (const book of bibleData) {
  // Add to book number map
  bookNumberMap.set(book.ord, book);
  
  // Add canonical name to name map
  bookNameMap.set(book.name.toLowerCase(), book);
  
  // Add all abbreviations to name map
  for (const abbr of book.abbreviations) {
    bookNameMap.set(abbr.toLowerCase(), book);
    bookNameMap.set(abbr.toLowerCase().replace(/\./g, ''), book);
  }
  
  // Add to regex pattern list
  // Escape special regex characters in names and abbreviations
  const escapedName = book.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  bookPatterns.push(escapedName);
  
  for (const abbr of book.abbreviations) {
    const escapedAbbr = abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    bookPatterns.push(escapedAbbr);
  }
}

// Sort patterns by length (longest first) to ensure we match "1 Kings" before "Kings"
bookPatterns.sort((a, b) => b.length - a.length);

// Verse reference regex - matches patterns like "John 3:16", "Gen 1:1-10", "1 Cor 13"
const verseRegex = new RegExp(
  `(\\d+\\s+)?(${bookPatterns.join('|')})\\s+(\\d+)(?:\\s*:\\s*(\\d+)(?:\\s*-\\s*(\\d+))?)?`,
  'i'
);

/**
 * Interface for a parsed Bible reference
 */
export interface BibleReference {
  book: string;       // Full book name
  bookId: string;     // Book ordinal (e.g., "01" for Genesis)
  chapter: number;    // Chapter number
  verse?: number;     // Optional verse number
  endVerse?: number;  // Optional ending verse for ranges
  testament: string;  // "OT" or "NT"
  osisId: string;     // OSIS identifier
}

/**
 * Parses a verse ID (e.g., "01001001" for Genesis 1:1)
 * @param id The verse ID in the format BBCCCVVV (book, chapter, verse)
 * @returns Parsed Bible reference
 */
export function parseVerseId(id: string): BibleReference | null {
  if (!id || id.length < 8) return null;
  
  const bookId = id.substring(0, 2);
  const chapter = parseInt(id.substring(2, 5), 10);
  const verse = parseInt(id.substring(5, 8), 10);
  
  const bookData = bookNumberMap.get(bookId);
  if (!bookData) return null;
  
  return {
    book: bookData.name,
    bookId,
    chapter,
    verse,
    testament: bookData.testament,
    osisId: bookData.osisId
  };
}

/**
 * Parses a word ID (e.g., "01001001001" for first word in Genesis 1:1)
 * @param id The word ID in the format BBCCCVVVWWW (book, chapter, verse, word)
 * @returns Object with verse reference and word position
 */
export function parseWordId(id: string): { reference: BibleReference, wordPosition: number } | null {
  if (!id || id.length < 11) return null;
  
  const verseRef = parseVerseId(id.substring(0, 8));
  if (!verseRef) return null;
  
  const wordPosition = parseInt(id.substring(8, 11), 10);
  
  return {
    reference: verseRef,
    wordPosition
  };
}

/**
 * Parses a human-readable verse reference (e.g., "John 3:16", "Gen 1:1-10")
 * @param reference The verse reference string
 * @returns Parsed Bible reference or null if invalid
 */
export function parseReference(reference: string): BibleReference | null {
  const match = verseRegex.exec(reference.trim());
  if (!match) return null;
  
  const [, prefix, bookName, chapter, verse, endVerse] = match;
  
  // Look up the book data
  const bookKey = (prefix && bookName) ? (prefix + bookName).toLowerCase() : bookName.toLowerCase();
  let bookData = bookNameMap.get(bookKey);
  
  // Try alternative lookup if not found (e.g., if abbreviation wasn't in exactly the right format)
  if (!bookData) {
    for (const [key, value] of bookNameMap.entries()) {
      if (bookKey.startsWith(key) || key.startsWith(bookKey)) {
        bookData = value;
        break;
      }
    }
  }
  
  if (!bookData) return null;
  
  // Create the reference object
  const result: BibleReference = {
    book: bookData.name,
    bookId: bookData.ord,
    chapter: parseInt(chapter, 10),
    testament: bookData.testament,
    osisId: bookData.osisId
  };
  
  // Add verse number if provided
  if (verse) {
    result.verse = parseInt(verse, 10);
  }
  
  // Add end verse if provided
  if (endVerse) {
    result.endVerse = parseInt(endVerse, 10);
  }
  
  return result;
}

/**
 * Validates if a reference is valid (book exists, chapter exists, verse exists)
 * @param reference The reference to validate
 * @returns True if valid, false otherwise
 */
export function isValidReference(reference: BibleReference): boolean {
  if (!reference) return false;
  
  // Get book data
  const bookData = bookNumberMap.get(reference.bookId);
  if (!bookData) return false;
  
  // Check if chapter exists
  const chapters = bookData.chapters;
  if (!chapters.hasOwnProperty(reference.chapter.toString())) return false;
  
  // If verse is specified, check if it exists
  if (reference.verse !== undefined) {
    const maxVerse = chapters[reference.chapter.toString()];
    if (reference.verse < 1 || reference.verse > maxVerse) return false;
  }
  
  // If end verse is specified, check if it's valid
  if (reference.endVerse !== undefined) {
    const maxVerse = chapters[reference.chapter.toString()];
    if (reference.endVerse < 1 || reference.endVerse > maxVerse || reference.endVerse < reference.verse!) {
      return false;
    }
  }
  
  return true;
}

/**
 * Formats a verse ID from a reference
 * @param ref The Bible reference
 * @returns The verse ID in the format BBCCCVVV
 */
export function formatVerseId(ref: BibleReference): string {
  const chapter = ref.chapter.toString().padStart(3, '0');
  const verse = (ref.verse || 1).toString().padStart(3, '0');
  return `${ref.bookId}${chapter}${verse}`;
}

/**
 * Formats a reference as a canonical string (e.g., "John 3:16")
 * @param ref The Bible reference
 * @returns Formatted reference string
 */
export function formatReference(ref: BibleReference): string {
  if (!ref.verse) {
    return `${ref.book} ${ref.chapter}`;
  }
  
  if (ref.endVerse) {
    return `${ref.book} ${ref.chapter}:${ref.verse}-${ref.endVerse}`;
  }
  
  return `${ref.book} ${ref.chapter}:${ref.verse}`;
}

/**
 * Gets an array of book names
 * @returns Array of book names
 */
export function getBookNames(): string[] {
  return bibleData.map((book: any) => book.name);
}

/**
 * Gets all alternative names and abbreviations for a book
 * @param bookId The book ID (ordinal)
 * @returns Array of names and abbreviations
 */
export function getBookAliases(bookId: string): string[] {
  const book: any = bookNumberMap.get(bookId);
  if (!book) return [];
  return [book.name, ...book.abbreviations];
}

/**
 * Converts a verse reference to a database ID for the specified table
 * @param ref The Bible reference
 * @param table The database table ('bsb_english', 'hebrew_ot', or 'greek_nt')
 * @returns The database ID for the reference
 */
export function referenceToDbId(ref: BibleReference, table: 'bsb_english'): string;
export function referenceToDbId(ref: BibleReference, table: 'hebrew_ot' | 'greek_nt'): string[];
export function referenceToDbId(ref: BibleReference, table: string): string | string[] {
  // For English table, return the verse ID
  if (table === 'bsb_english') {
    return formatVerseId(ref);
  }
  
  // For original language tables (hebrew_ot, greek_nt), return a pattern for matching all words in the verse
  const verseId = formatVerseId(ref);
  if (table === 'hebrew_ot' || table === 'greek_nt') {
    // Generate word IDs for all possible word positions (up to 999)
    // In practice, a verse likely won't have more than 100 words
    // The database will filter out non-existent IDs
    return Array.from({ length: 999 }, (_, i) => 
      `${verseId}${(i + 1).toString().padStart(3, '0')}`
    );
  }
  
  throw new Error(`Unknown table: ${table}`);
}

export default {
  parseVerseId,
  parseWordId,
  parseReference,
  isValidReference,
  formatVerseId,
  formatReference,
  getBookNames,
  getBookAliases,
  referenceToDbId
};