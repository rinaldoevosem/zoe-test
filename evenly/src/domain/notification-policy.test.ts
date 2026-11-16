import { describe, expect, test } from "vitest";
import { planDeliveries, type ChannelSettings } from "./notification-policy";

const TZ = "America/New_York";
// 2026-11-16 is EST (UTC-5): local 14:00 = 19:00Z.
const at = (localTime: string, date = "2026-11-16") => Date.parse(`${date}T${localTime}:00-05:00`);
const person: ChannelSettings = { email: "pat@riverside.example", phone: "+15550100", emailOn: true, smsOn: true, quietStart: 21 * 60, quietEnd: 7 * 60 };

describe("planDeliveries", () => {
  test("a normal Notification goes by email now, never by text", () => {
    expect(planDeliveries("normal", person, at("14:00"), TZ)).toEqual([{ channel: "email", to: "pat@riverside.example", sendAt: at("14:00") }]);
  });

  test("an Urgent Notification goes by email and text now, even in Quiet Hours", () => {
    for (const t of ["14:00", "23:30"]) {
      expect(planDeliveries("urgent", person, at(t), TZ)).toEqual([
        { channel: "email", to: "pat@riverside.example", sendAt: at(t) },
        { channel: "sms", to: "+15550100", sendAt: at(t) },
      ]);
    }
  });

  test("Quiet Hours hold a normal email until they end, across midnight", () => {
    expect(planDeliveries("normal", person, at("23:00"), TZ)).toEqual([{ channel: "email", to: "pat@riverside.example", sendAt: at("07:00", "2026-11-17") }]);
    expect(planDeliveries("normal", person, at("05:15"), TZ)).toEqual([{ channel: "email", to: "pat@riverside.example", sendAt: at("07:00") }]);
    expect(planDeliveries("normal", person, at("07:00"), TZ)[0].sendAt).toBe(at("07:00"));
  });

  test("a daytime Quiet Hours window holds until it ends the same day", () => {
    const lunch = { ...person, quietStart: 12 * 60, quietEnd: 13 * 60 };
    expect(planDeliveries("normal", lunch, at("12:30"), TZ)[0].sendAt).toBe(at("13:00"));
    expect(planDeliveries("normal", lunch, at("13:30"), TZ)[0].sendAt).toBe(at("13:30"));
  });

  test("switched-off channels and missing addresses send nothing", () => {
    expect(planDeliveries("urgent", { ...person, emailOn: false, smsOn: false }, at("14:00"), TZ)).toEqual([]);
    expect(planDeliveries("urgent", { ...person, email: null, phone: null }, at("14:00"), TZ)).toEqual([]);
    expect(planDeliveries("normal", { ...person, quietStart: null, quietEnd: null }, at("23:00"), TZ)[0].sendAt).toBe(at("23:00"));
  });
});
