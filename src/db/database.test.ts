// import { getEnglishText } from "./database.js";
import { getEnglishText } from "@/db/database.ts";

test("Retrieve James 1:5 (English)", () => {
  const result = getEnglishText({
    book: "James",
    bookId: "59",
    chapter: 1,
    verse: 5,
    testament: "NT",
    osisId: "Jas 1:5",
  });
  expect(result).toBe(
    "Now if any of you lacks wisdom, he should ask God, who gives generously to all without finding fault, and it will be given to him.",
  );
});

test("Retrieve Genesis 1:1 (English) from Old Testament", () => {
  const result = getEnglishText({
    book: "Genesis",
    bookId: "01",
    chapter: 1,
    verse: 1,
    testament: "OT",
    osisId: "Gen 1:1",
  });
  expect(result).toBe(
    "In the beginning God created the heavens and the earth.",
  );
});

test("Retrieve Psalm 46:10 (English) with source versification", () => {
  const result = getEnglishText({
    book: "Psalms",
    bookId: "19",
    chapter: 46,
    verse: 10,
    testament: "OT",
    osisId: "Ps 46:10",
  });
  expect(result).toBe(
    "“Be still and know that I am God; I will be exalted among the nations, I will be exalted over the earth.”",
  );
});
