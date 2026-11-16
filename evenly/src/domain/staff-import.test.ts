import { describe, expect, test } from "vitest";
import { parseStaffCsv } from "./staff-import";

describe("parseStaffCsv", () => {
  test("reads name, email, clinical role, FTE and Tags with optional Certification expiry", () => {
    const csv = [
      "Name,Email,Clinical Role,FTE,Tags",
      'Dr. Ada Park,ADA.PARK@riverside.example,physician,0.8,"md; procedures:2027-03-31"',
      "Sam Lee NP,sam.lee@riverside.example,NP,,app",
    ].join("\n");
    expect(parseStaffCsv(csv)).toEqual({
      rows: [
        { line: 2, name: "Dr. Ada Park", email: "ada.park@riverside.example", clinicalRole: "physician", fte: 0.8, tags: ["md", "procedures"], tagExpiry: { procedures: "2027-03-31" } },
        { line: 3, name: "Sam Lee NP", email: "sam.lee@riverside.example", clinicalRole: "NP", fte: 1, tags: ["app"], tagExpiry: {} },
      ],
      errors: [],
    });
  });

  test("reports bad rows with their line number and reason, and keeps the good ones", () => {
    const csv = "name,email,fte\nGood,good@x.example,1\n,nobody@x.example,1\nBad Email,not-an-email,1\nToo Much,t@x.example,1.5\nGood,good@x.example,1\n";
    const { rows, errors } = parseStaffCsv(csv);
    expect(rows.map((r) => r.name)).toEqual(["Good"]);
    expect(errors).toEqual([
      { line: 3, message: "Name is missing" },
      { line: 4, message: "Email \"not-an-email\" doesn't look like an email address" },
      { line: 5, message: "FTE must be above 0 and at most 1" },
      { line: 6, message: "good@x.example appears more than once" },
    ]);
  });

  test("requires the name and email columns and rejects bad expiry dates", () => {
    expect(parseStaffCsv("full name,mail\nA,a@x.example").errors).toEqual([{ line: 1, message: "The first row needs Name and Email columns" }]);
    expect(parseStaffCsv("name,email,tags\nA,a@x.example,procedures:31/03/2027").errors).toEqual([{ line: 2, message: "Tag expiry \"31/03/2027\" must be a date like 2027-03-31" }]);
  });
});
