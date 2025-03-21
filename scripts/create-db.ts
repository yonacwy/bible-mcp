#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { parse } from 'csv-parse/sync';
import { parseVerseId } from '../src/utils/referenceUtils.js';

// Setup database
const dbPath = path.join(process.cwd(), 'bible.db');
console.log(`Creating database at ${dbPath}`);

// Remove existing database if it exists
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Create tables
console.log('Creating tables...');

// Hebrew Old Testament
db.exec(`
CREATE TABLE hebrew_ot (
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
  number TEXT
);
CREATE INDEX idx_hebrew_ot_ref ON hebrew_ot(ref);
CREATE INDEX idx_hebrew_ot_book_num ON hebrew_ot(book_num);
CREATE INDEX idx_hebrew_ot_book_chapter ON hebrew_ot(book_num, chapter);
CREATE INDEX idx_hebrew_ot_book_chapter_verse ON hebrew_ot(book_num, chapter, verse);
`);

// Greek New Testament
db.exec(`
CREATE TABLE greek_nt (
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
  case_info TEXT
);
CREATE INDEX idx_greek_nt_ref ON greek_nt(ref);
CREATE INDEX idx_greek_nt_book_num ON greek_nt(book_num);
CREATE INDEX idx_greek_nt_book_chapter ON greek_nt(book_num, chapter);
CREATE INDEX idx_greek_nt_book_chapter_verse ON greek_nt(book_num, chapter, verse);
`);

// English Bible (BSB)
db.exec(`
CREATE TABLE bsb_english (
  id TEXT PRIMARY KEY,
  verse_ref TEXT NOT NULL,
  text TEXT NOT NULL,
  book_num TEXT NOT NULL,
  book_name TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL
);
CREATE INDEX idx_bsb_english_verse_ref ON bsb_english(verse_ref);
CREATE INDEX idx_bsb_english_book_num ON bsb_english(book_num);
CREATE INDEX idx_bsb_english_book_name ON bsb_english(book_name);
CREATE INDEX idx_bsb_english_book_chapter ON bsb_english(book_num, chapter);
CREATE INDEX idx_bsb_english_book_chapter_verse ON bsb_english(book_num, chapter, verse);
`);

// Map of book numbers to book names
const bookNames: Record<string, string> = {
  '01': 'Genesis', '02': 'Exodus', '03': 'Leviticus', '04': 'Numbers', '05': 'Deuteronomy',
  '06': 'Joshua', '07': 'Judges', '08': 'Ruth', '09': '1 Samuel', '10': '2 Samuel',
  '11': '1 Kings', '12': '2 Kings', '13': '1 Chronicles', '14': '2 Chronicles', '15': 'Ezra',
  '16': 'Nehemiah', '17': 'Esther', '18': 'Job', '19': 'Psalms', '20': 'Proverbs',
  '21': 'Ecclesiastes', '22': 'Song of Solomon', '23': 'Isaiah', '24': 'Jeremiah', '25': 'Lamentations',
  '26': 'Ezekiel', '27': 'Daniel', '28': 'Hosea', '29': 'Joel', '30': 'Amos',
  '31': 'Obadiah', '32': 'Jonah', '33': 'Micah', '34': 'Nahum', '35': 'Habakkuk',
  '36': 'Zephaniah', '37': 'Haggai', '38': 'Zechariah', '39': 'Malachi',
  '40': 'Matthew', '41': 'Mark', '42': 'Luke', '43': 'John', '44': 'Acts',
  '45': 'Romans', '46': '1 Corinthians', '47': '2 Corinthians', '48': 'Galatians', '49': 'Ephesians',
  '50': 'Philippians', '51': 'Colossians', '52': '1 Thessalonians', '53': '2 Thessalonians', '54': '1 Timothy',
  '55': '2 Timothy', '56': 'Titus', '57': 'Philemon', '58': 'Hebrews', '59': 'James',
  '60': '1 Peter', '61': '2 Peter', '62': '1 John', '63': '2 John', '64': '3 John',
  '65': 'Jude', '66': 'Revelation'
};

// Function to parse word position from OT/NT word IDs
function parseWordPosition(id: string): number {
  // Format like "01001001001" (last 3 digits are word position)
  if (id.length < 11) return 0;
  return parseInt(id.substring(8, 11), 10);
}

// Import Hebrew OT data
async function importHebrewOT(): Promise<void> {
  console.log('Importing Hebrew OT data...');
  const hebrewData = path.join(process.cwd(), 'data', 'macula-hebrew.tsv');
  
  const insert = db.prepare(`
    INSERT INTO hebrew_ot (
      id, ref, book_num, book_name, chapter, verse, word_position,
      class, text, transliteration, strong_number, lemma, morph, pos, gender, number
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const fileContent = fs.readFileSync(hebrewData, 'utf8');
  const records = parse(fileContent, {
    delimiter: '\t',
    columns: true,
    skip_empty_lines: true
  });
  
  const insertMany = db.transaction((rows: any[]) => {
    for (const row of rows) {
      const id = row.xml_id || row['xml:id'];
      
      // Extract reference info from the ref field (format like "GEN 1:1!1")
      const refParts = row.ref.split(/[ :!]/);
      const bookAbbr = refParts[0];
      let bookNum = '';
      
      // Find book number from abbreviation (a bit crude, but works for this purpose)
      for (const [num, name] of Object.entries(bookNames)) {
        if (num.startsWith('0') && parseInt(num, 10) <= 39 && name.toUpperCase().startsWith(bookAbbr)) {
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
      
      insert.run(
        id,
        row.ref,
        bookNum,
        bookNames[bookNum] || '',
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
        row.number
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
  console.log('Importing Greek NT data...');
  const greekData = path.join(process.cwd(), 'data', 'macula-greek-SBLGNT.tsv');
  
  const insert = db.prepare(`
    INSERT INTO greek_nt (
      id, ref, book_num, book_name, chapter, verse, word_position,
      class, text, lemma, strong, morph, pos, person, gender, number, case_info
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const fileContent = fs.readFileSync(greekData, 'utf8');
  const records = parse(fileContent, {
    delimiter: '\t',
    columns: true,
    skip_empty_lines: true
  });
  
  const insertMany = db.transaction((rows: any[]) => {
    for (const row of rows) {
      const id = row.xml_id || row['xml:id'];
      
      // Extract reference info from the ref field (format like "MAT 1:1!1")
      const refParts = row.ref.split(/[ :!]/);
      const bookAbbr = refParts[0];
      let bookNum = '';
      
      // Find book number from abbreviation
      for (const [num, name] of Object.entries(bookNames)) {
        if (parseInt(num, 10) >= 40 && name.toUpperCase().startsWith(bookAbbr)) {
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
      
      insert.run(
        id,
        row.ref,
        bookNum,
        bookNames[bookNum] || '',
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
        row.case
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

// Process BSB English data
async function processVerseData(filePath: string, testament: string): Promise<any[]> {
  const verseData = path.join(process.cwd(), 'data', filePath);
  
  const fileContent = fs.readFileSync(verseData, 'utf8');
  const records = parse(fileContent, {
    delimiter: '\t',
    columns: true,
    skip_empty_lines: true
  });
  
  // Process verse words into complete verses
  const verses: Record<string, string[]> = {};
  
  for (const row of records) {
    if (row.exclude === 'y') continue;
    
    const verseRef = row.source_verse;
    if (!verses[verseRef]) {
      verses[verseRef] = [];
    }
    
    // Add space after word unless specified not to
    const text = row.text + (row.skip_space_after === 'y' ? '' : ' ');
    verses[verseRef].push(text);
  }
  
  // Convert to array of complete verses
  const completeVerses = [];
  for (const [verseRef, wordArray] of Object.entries(verses)) {
    const parsedRef = parseVerseId(verseRef);
    if (!parsedRef) continue;
    
    const text = wordArray.join('').trim();
    
    completeVerses.push({
      id: verseRef,
      verse_ref: `${parsedRef.book} ${parsedRef.chapter}:${parsedRef.verse}`,
      text,
      book_num: parsedRef.bookId,
      book_name: parsedRef.book,
      chapter: parsedRef.chapter,
      verse: parsedRef.verse
    });
  }
  
  return completeVerses;
}

// Import BSB English data
async function importBSBEnglish(): Promise<void> {
  console.log('Importing BSB English data...');
  
  // Process OT and NT separately, then combine
  const otVerses = await processVerseData('ot_BSB.tsv', 'OT');
  const ntVerses = await processVerseData('nt_BSB.tsv', 'NT');
  const allVerses = [...otVerses, ...ntVerses];
  
  // Insert into database
  const insert = db.prepare(`
    INSERT INTO bsb_english (
      id, verse_ref, text, book_num, book_name, chapter, verse
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertMany = db.transaction((verses: any[]) => {
    for (const verse of verses) {
      insert.run(
        verse.id,
        verse.verse_ref,
        verse.text,
        verse.book_num,
        verse.book_name,
        verse.chapter,
        verse.verse
      );
    }
  });
  
  // Insert in batches
  const batchSize = 1000;
  for (let i = 0; i < allVerses.length; i += batchSize) {
    const batch = allVerses.slice(i, i + batchSize);
    insertMany(batch);
    process.stdout.write(`\rProcessed ${Math.min(i + batchSize, allVerses.length)} of ${allVerses.length} verses...`);
  }
  
  console.log(`\nImported ${allVerses.length} BSB English verses.`);
}

// Run all import functions
async function importAll(): Promise<void> {
  try {
    await importHebrewOT();
    await importGreekNT();
    await importBSBEnglish();
    
    // Create views for common queries
    
    // 1. View for complete verses (BSB English)
    db.exec(`
      CREATE VIEW verse_view AS
      SELECT 
        id,
        verse_ref,
        text as english_text,
        book_num,
        book_name,
        chapter,
        verse
      FROM bsb_english
    `);
    
    // 2. View for Hebrew words with verse context
    db.exec(`
      CREATE VIEW hebrew_word_view AS
      SELECT 
        h.id,
        h.ref,
        h.text as hebrew_text,
        h.lemma,
        h.strong_number,
        h.transliteration,
        h.book_num,
        h.book_name,
        h.chapter,
        h.verse,
        h.word_position,
        b.text as english_verse
      FROM hebrew_ot h
      LEFT JOIN bsb_english b ON h.book_num = b.book_num AND h.chapter = b.chapter AND h.verse = b.verse
    `);
    
    // 3. View for Greek words with verse context
    db.exec(`
      CREATE VIEW greek_word_view AS
      SELECT 
        g.id,
        g.ref,
        g.text as greek_text,
        g.lemma,
        g.strong,
        g.book_num,
        g.book_name,
        g.chapter,
        g.verse,
        g.word_position,
        b.text as english_verse
      FROM greek_nt g
      LEFT JOIN bsb_english b ON g.book_num = b.book_num AND g.chapter = b.chapter AND g.verse = b.verse
    `);
    
    console.log('Database creation complete!');
  } catch (error) {
    console.error('Error importing data:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

importAll();