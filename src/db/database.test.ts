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
