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
  console.log(result);
});
