import { describe, expect, test } from "vitest";
import { checkAssignment } from "./rules";
import { expiringCertifications, holdsTag } from "./certifications";
import { ctx, shift, staff } from "./testing/builders";

const proc = (id: string, date: string) => shift(id, date, { label: "Procedure Service", requiredTags: ["procedures"] });

describe("Certifications (Tags with expiry dates)", () => {
  const sofia = staff("sofia", { name: "Dr. Reyes", tags: ["procedures"], tagExpiry: { procedures: "2026-11-30" } });

  test("a Tag qualifies through its expiry date and not after", () => {
    expect(holdsTag(sofia, "procedures", "2026-11-30")).toBe(true);
    expect(holdsTag(sofia, "procedures", "2026-12-01")).toBe(false);
    expect(holdsTag(staff("x", { tags: ["procedures"] }), "procedures", "2099-01-01")).toBe(true);
    expect(holdsTag(staff("x"), "procedures", "2026-01-01")).toBe(false);
  });

  test("an expired Certification is a Hard Violation that names the expiry date", () => {
    const c = ctx({ staff: [sofia], shifts: [proc("before", "2026-11-30"), proc("after", "2026-12-01")] });
    expect(checkAssignment(c, { shiftId: "before", staffId: "sofia" })).toEqual([]);
    const vs = checkAssignment(c, { shiftId: "after", staffId: "sofia" });
    expect(vs.map((v) => [v.rule, v.severity, v.message])).toEqual([
      ["requiredTags", "hard", "Dr. Reyes's procedures Certification expired on 2026-11-30"],
    ]);
  });

  test("lists Certifications that expire within a window, soonest first, including ones already expired", () => {
    const people = [
      sofia,
      staff("dan", { name: "Dr. Okafor", tags: ["procedures", "md"], tagExpiry: { procedures: "2026-12-20" } }),
      staff("morgan", { name: "Dr. Lee", tags: ["procedures"], tagExpiry: { procedures: "2027-06-01" } }),
      staff("old", { name: "Dr. Old", tags: ["procedures"], tagExpiry: { procedures: "2026-10-01" } }),
    ];
    expect(expiringCertifications(people, "2026-11-16", 45)).toEqual([
      { staffId: "old", tag: "procedures", expires: "2026-10-01", daysLeft: -46 },
      { staffId: "sofia", tag: "procedures", expires: "2026-11-30", daysLeft: 14 },
      { staffId: "dan", tag: "procedures", expires: "2026-12-20", daysLeft: 34 },
    ]);
  });
});
