#!/usr/bin/env node

import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { parse } from "csv-parse/sync";
import { parseVerseId } from "../src/utils/referenceUtils.js";

// Setup database
const dbPath = path.join(process.cwd(), "bible.db");
console.log(`Creating database at ${dbPath}`);

// Remove existing database if it exists
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

// Create tables
console.log("Creating tables...");

// Hebrew Old Testament
db.exec(`
CREATE TABLE hebrew_tokens (
  id TEXT PRIMARY KEY,
  ref TEXT NOT NULL,
  book_num TEXT NOT NULL,
  book_name TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  word_position INTEGER NOT NULL,
  class TEXT,
  text TEXT NOT NULL,
  transliteration TEXT,
  strong_number TEXT,
  lemma TEXT,
  morph TEXT,
  pos TEXT,
  gender TEXT,
  number TEXT,
  skip_space_after BOOLEAN DEFAULT 0
);
CREATE INDEX idx_hebrew_tokens_ref ON hebrew_tokens(ref);
CREATE INDEX idx_hebrew_tokens_book_num ON hebrew_tokens(book_num);
CREATE INDEX idx_hebrew_tokens_book_chapter ON hebrew_tokens(book_num, chapter);
CREATE INDEX idx_hebrew_tokens_book_chapter_verse ON hebrew_tokens(book_num, chapter, verse);
`);

// Greek New Testament
db.exec(`
CREATE TABLE greek_tokens (
  id TEXT PRIMARY KEY,
  ref TEXT NOT NULL,
  book_num TEXT NOT NULL,
  book_name TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  word_position INTEGER NOT NULL,
  class TEXT,
  text TEXT NOT NULL,
  lemma TEXT,
  strong TEXT,
  morph TEXT,
  pos TEXT,
  person TEXT,
  gender TEXT,
  number TEXT,
  case_info TEXT,
  skip_space_after BOOLEAN DEFAULT 0
);
CREATE INDEX idx_greek_tokens_ref ON greek_tokens(ref);
CREATE INDEX idx_greek_tokens_book_num ON greek_tokens(book_num);
CREATE INDEX idx_greek_tokens_book_chapter ON greek_tokens(book_num, chapter);
CREATE INDEX idx_greek_tokens_book_chapter_verse ON greek_tokens(book_num, chapter, verse);
`);

// English Bible (BSB)
db.exec(`
CREATE TABLE english_tokens (
  id TEXT PRIMARY KEY,
  book_num TEXT NOT NULL,
  book_name TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  word_position INTEGER NOT NULL,
  text TEXT NOT NULL,
  skip_space_after BOOLEAN NOT NULL,
  exclude BOOLEAN NOT NULL
);
CREATE INDEX idx_english_tokens_book_num ON english_tokens(book_num);
CREATE INDEX idx_english_tokens_book_chapter ON english_tokens(book_num, chapter);
CREATE INDEX idx_english_tokens_book_chapter_verse ON english_tokens(book_num, chapter, verse);
`);

// Map of book numbers to book names
const bookNames: Record<string, string> = {
  "01": "Genesis",
  "02": "Exodus",
  "03": "Leviticus",
  "04": "Numbers",
  "05": "Deuteronomy",
  "06": "Joshua",
  "07": "Judges",
  "08": "Ruth",
  "09": "1 Samuel",
  "10": "2 Samuel",
  "11": "1 Kings",
  "12": "2 Kings",
  "13": "1 Chronicles",
  "14": "2 Chronicles",
  "15": "Ezra",
  "16": "Nehemiah",
  "17": "Esther",
  "18": "Job",
  "19": "Psalms",
  "20": "Proverbs",
  "21": "Ecclesiastes",
  "22": "Song of Solomon",
  "23": "Isaiah",
  "24": "Jeremiah",
  "25": "Lamentations",
  "26": "Ezekiel",
  "27": "Daniel",
  "28": "Hosea",
  "29": "Joel",
  "30": "Amos",
  "31": "Obadiah",
  "32": "Jonah",
  "33": "Micah",
  "34": "Nahum",
  "35": "Habakkuk",
  "36": "Zephaniah",
  "37": "Haggai",
  "38": "Zechariah",
  "39": "Malachi",
  "40": "Matthew",
  "41": "Mark",
  "42": "Luke",
  "43": "John",
  "44": "Acts",
  "45": "Romans",
  "46": "1 Corinthians",
  "47": "2 Corinthians",
  "48": "Galatians",
  "49": "Ephesians",
  "50": "Philippians",
  "51": "Colossians",
  "52": "1 Thessalonians",
  "53": "2 Thessalonians",
  "54": "1 Timothy",
  "55": "2 Timothy",
  "56": "Titus",
  "57": "Philemon",
  "58": "Hebrews",
  "59": "James",
  "60": "1 Peter",
  "61": "2 Peter",
  "62": "1 John",
  "63": "2 John",
  "64": "3 John",
  "65": "Jude",
  "66": "Revelation",
};

// Function to parse word position from OT/NT word IDs
function parseWordPosition(id: string): number {
  // Format like "01001001001" (last 3 digits are word position)
  if (id.length < 11) return 0;
  return parseInt(id.substring(8, 11), 10);
}

// Import Hebrew OT data
async function importHebrewOT(): Promise<void> {
  console.log("Importing Hebrew OT data...");
  const hebrewData = path.join(process.cwd(), "data", "macula-hebrew.tsv");

  const insert = db.prepare(`
    INSERT INTO hebrew_tokens (
      id, ref, book_num, book_name, chapter, verse, word_position,
      class, text, transliteration, strong_number, lemma, morph, pos, gender, number, skip_space_after
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const fileContent = fs.readFileSync(hebrewData, "utf8");
  const records = parse(fileContent, {
    delimiter: "\t",
    columns: true,
    skip_empty_lines: true,
  });

  const insertMany = db.transaction((rows: any[]) => {
    for (const row of rows) {
      const id = row.xml_id || row["xml:id"];

      // Extract reference info from the ref field (format like "GEN 1:1!1")
      const refParts = row.ref.split(/[ :!]/);
      const bookAbbr = refParts[0];
      let bookNum = "";

      // Find book number from abbreviation (a bit crude, but works for this purpose)
      for (const [num, name] of Object.entries(bookNames)) {
        if (
          num.startsWith("0") &&
          parseInt(num, 10) <= 39 &&
          name.toUpperCase().startsWith(bookAbbr)
        ) {
          bookNum = num;
          break;
        }
      }

      if (!bookNum && id.length >= 8) {
        // Extract from ID if ref parsing fails
        bookNum = id.substring(0, 2);
      }

      const chapter = refParts.length > 1 ? parseInt(refParts[1], 10) : 0;
      const verse = refParts.length > 2 ? parseInt(refParts[2], 10) : 0;
      const wordPosition = parseWordPosition(id);

      // In Hebrew, we might need heuristics for skip_space_after
      // For now, we'll set it to false (0) for most words, except for words followed by punctuation
      const skipSpaceAfter = 0; // Default to not skipping spaces

      insert.run(
        id,
        row.ref,
        bookNum,
        bookNames[bookNum] || "",
        chapter,
        verse,
        wordPosition,
        row.class,
        row.text,
        row.transliteration,
        row.strongnumberx,
        row.lemma,
        row.morph,
        row.pos,
        row.gender,
        row.number,
        skipSpaceAfter,
      );
    }
  });

  const rows = [];
  let count = 0;
  const batchSize = 1000;

  for (const row of records) {
    rows.push(row);
    count++;

    if (rows.length >= batchSize) {
      insertMany(rows);
      rows.length = 0;
      process.stdout.write(`\rProcessed ${count} rows...`);
    }
  }

  if (rows.length > 0) {
    insertMany(rows);
  }

  console.log(`\nImported ${count} Hebrew OT rows.`);
}

// Import Greek NT data
async function importGreekNT(): Promise<void> {
  console.log("Importing Greek NT data...");
  const greekData = path.join(process.cwd(), "data", "macula-greek-SBLGNT.tsv");

  const insert = db.prepare(`
    INSERT INTO greek_tokens (
      id, ref, book_num, book_name, chapter, verse, word_position,
      class, text, lemma, strong, morph, pos, person, gender, number, case_info, skip_space_after
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const fileContent = fs.readFileSync(greekData, "utf8");
  const records = parse(fileContent, {
    delimiter: "\t",
    columns: true,
    skip_empty_lines: true,
  });

  const insertMany = db.transaction((rows: any[]) => {
    for (const row of rows) {
      const id = row.xml_id || row["xml:id"];

      // Extract reference info from the ref field (format like "MAT 1:1!1")
      const refParts = row.ref.split(/[ :!]/);
      const bookAbbr = refParts[0];
      let bookNum = "";

      // Find book number from abbreviation
      for (const [num, name] of Object.entries(bookNames)) {
        if (
          parseInt(num, 10) >= 40 &&
          name.toUpperCase().startsWith(bookAbbr)
        ) {
          bookNum = num;
          break;
        }
      }

      if (!bookNum && id.length >= 8) {
        // Extract from ID if ref parsing fails
        bookNum = id.substring(0, 2);
      }

      const chapter = refParts.length > 1 ? parseInt(refParts[1], 10) : 0;
      const verse = refParts.length > 2 ? parseInt(refParts[2], 10) : 0;
      const wordPosition = parseWordPosition(id);

      // In Greek, we might need heuristics for skip_space_after
      // For now, we'll set it to false (0) for most words
      const skipSpaceAfter = 0; // Default to not skipping spaces

      insert.run(
        id,
        row.ref,
        bookNum,
        bookNames[bookNum] || "",
        chapter,
        verse,
        wordPosition,
        row.class,
        row.text,
        row.lemma,
        row.strong,
        row.morph,
        row.pos,
        row.person,
        row.gender,
        row.number,
        row.case,
        skipSpaceAfter,
      );
    }
  });

  const rows = [];
  let count = 0;
  const batchSize = 1000;

  for (const row of records) {
    rows.push(row);
    count++;

    if (rows.length >= batchSize) {
      insertMany(rows);
      rows.length = 0;
      process.stdout.write(`\rProcessed ${count} rows...`);
    }
  }

  if (rows.length > 0) {
    insertMany(rows);
  }

  console.log(`\nImported ${count} Greek NT rows.`);
}

// Import BSB English tokens directly
async function importBSBEnglish(): Promise<void> {
  console.log("Importing BSB English token data...");

  // Process OT and NT tokens
  await importBSBTokens("ot_BSB.tsv");
  await importBSBTokens("nt_BSB.tsv");
}

// Import BSB tokens from TSV file
async function importBSBTokens(filePath: string): Promise<void> {
  const tokenData = path.join(process.cwd(), "data", filePath);

  const insert = db.prepare(`
    INSERT INTO english_tokens (
      id, book_num, book_name, chapter, verse, word_position, text, skip_space_after, exclude
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const fileContent = fs.readFileSync(tokenData, "utf8");
  const records = parse(fileContent, {
    delimiter: "\t",
    columns: true,
    skip_empty_lines: true,
  });

  const insertMany = db.transaction((rows: any[]) => {
    for (const row of rows) {
      // Parse the source_verse to get book, chapter, verse
      const id = row.id; // Format like "01001001" (book+chapter+verse)
      if (!id || id.length < 8) continue;

      const bookNum = id.substring(0, 2);
      const chapter = parseInt(id.substring(2, 5), 10);
      const verse = parseInt(id.substring(5, 8), 10);

      // Parse the id to get word position
      const wordPosition =
        id && id.length >= 11 ? parseInt(id.substring(8, 11), 10) : 0;

      insert.run(
        id,
        bookNum,
        bookNames[bookNum] || "",
        chapter,
        verse,
        wordPosition,
        row.text,
        row.skip_space_after === "y" ? 1 : 0,
        row.exclude === "y" ? 1 : 0,
      );
    }
  });

  const rows = [];
  let count = 0;
  const batchSize = 1000;

  for (const row of records) {
    rows.push(row);
    count++;

    if (rows.length >= batchSize) {
      insertMany(rows);
      rows.length = 0;
      process.stdout.write(`\rProcessed ${count} rows...`);
    }
  }

  if (rows.length > 0) {
    insertMany(rows);
  }

  console.log(`\nImported ${count} BSB English tokens from ${filePath}.`);
}

// Run all import functions
async function importAll(): Promise<void> {
  try {
    await importHebrewOT();
    await importGreekNT();
    await importBSBEnglish();

    console.log("Database creation complete!");
  } catch (error) {
    console.error("Error importing data:", error);
    process.exit(1);
  } finally {
    db.close();
  }
}

importAll();
