/**
 * Notification policy (GLOSSARY: Notification, Urgent, Quiet Hours, Delivery). Pure: given how urgent a
 * Notification is, one person's channel settings and the time, decide which emails and text messages to send
 * and when. The in-app inbox always gets every Notification; this decides only the extra channels.
 */
import { addDays, instantToLocalDate, instantToLocalMinute, localToInstant } from "./time";

export type Urgency = "normal" | "urgent";

export interface ChannelSettings {
  email: string | null;
  phone: string | null;
  emailOn: boolean;
  smsOn: boolean;
  /** Quiet Hours as minutes after local midnight; the window may cross midnight. Null = none. */
  quietStart: number | null;
  quietEnd: number | null;
}

export interface PlannedDelivery {
  channel: "email" | "sms";
  to: string;
  /** Epoch ms: now, or when Quiet Hours end. */
  sendAt: number;
}

export function planDeliveries(urgency: Urgency, s: ChannelSettings, now: number, timeZone: string): PlannedDelivery[] {
  const sendAt = urgency === "urgent" ? now : quietHoursEnd(s, now, timeZone) ?? now;
  const out: PlannedDelivery[] = [];
  if (s.emailOn && s.email) out.push({ channel: "email", to: s.email, sendAt });
  // Text messages are for Urgent Notifications only.
  if (urgency === "urgent" && s.smsOn && s.phone) out.push({ channel: "sms", to: s.phone, sendAt });
  return out;
}

/** When the Quiet Hours window containing `now` ends, or null when `now` is outside it. */
function quietHoursEnd(s: ChannelSettings, now: number, timeZone: string): number | null {
  if (s.quietStart === null || s.quietEnd === null || s.quietStart === s.quietEnd) return null;
  const minute = instantToLocalMinute(now, timeZone);
  const today = instantToLocalDate(now, timeZone);
  const crossesMidnight = s.quietStart > s.quietEnd;
  const inside = crossesMidnight ? minute >= s.quietStart || minute < s.quietEnd : minute >= s.quietStart && minute < s.quietEnd;
  if (!inside) return null;
  const endDay = crossesMidnight && minute >= s.quietStart ? addDays(today, 1) : today;
  return localToInstant(endDay, s.quietEnd, timeZone);
}
