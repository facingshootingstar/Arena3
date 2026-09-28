import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isValidVnPhone, normalizePhone, passwordOk, phoneLast9 } from "./phone.ts";
import { rruleLabel } from "./labels.ts";
import { numberToVietnamese, vndInWords } from "./money-words.ts";
import { addDays, elapsedAtLeast, ictDateTime, ictHour, ictMinutes, pad2, roundVnd } from "./time.ts";

describe("phone", () => {
  it("normalizes VN mobiles to +84", () => {
    assert.equal(normalizePhone("0900000001"), "+84900000001");
    assert.equal(normalizePhone("+84900000001"), "+84900000001");
    assert.equal(normalizePhone("900000001"), "+84900000001");
    assert.equal(normalizePhone("090 000 0001"), "+84900000001");
    assert.equal(phoneLast9("0908825218"), "908825218");
    assert.ok(isValidVnPhone("0900000001"));
    assert.ok(isValidVnPhone("+84900000001"));
    assert.equal(isValidVnPhone("+84120000001"), false);
  });
  it("rejects short passwords", () => {
    assert.equal(passwordOk("abc"), false);
    assert.equal(passwordOk("ChangeMe!a3"), true);
  });
});

describe("time / price slot", () => {
  it("reads ICT wall clock from a +07 instant", () => {
    const start = ictDateTime("2026-09-14", "17:30");
    assert.equal(ictHour(start), 17);
    assert.equal(ictMinutes(start), 17 * 60 + 30);
    assert.equal(pad2(ictHour(start)), "17");
  });
  it("does not use the host timezone for invoice hours", () => {
    const start = new Date("2026-09-14T10:00:00+07:00");
    assert.equal(pad2(ictHour(start)), "10");
    assert.notEqual(pad2(start.getUTCHours()), "10");
  });
  it("addDays stays on the calendar date", () => {
    assert.equal(addDays("2026-09-30", 1), "2026-10-01");
  });
});

describe("pricing", () => {
  it("rounds member discount to 1000đ", () => {
    assert.equal(roundVnd(140000 * (1 - 20 / 100)), 112000);
    assert.equal(roundVnd(80000 * (1 - 15 / 100)), 68000);
  });
});

describe("rrule", () => {
  it("labels weekly BYDAY in English", () => {
    assert.equal(rruleLabel("FREQ=WEEKLY;BYDAY=MO,WE,FR;BYHOUR=18"), "Mon, Wed, Fri · 18:00");
  });
  it("builds Monday 18:00 ICT from the date+hour helper", () => {
    const start = ictDateTime("2026-09-14", "18:00");
    assert.equal(ictHour(start), 18);
    assert.equal(start.toISOString(), new Date("2026-09-14T18:00:00+07:00").toISOString());
  });
});

describe("jobs", () => {
  it("materializes class sessions at most once per window", () => {
    assert.equal(elapsedAtLeast(undefined, 1000, 600), true);
    assert.equal(elapsedAtLeast(1000, 1599, 600), false);
    assert.equal(elapsedAtLeast(1000, 1600, 600), true);
  });
});

describe("money in words", () => {
  it("spells the digits a VN invoice trips over", () => {
    assert.equal(numberToVietnamese(0), "không");
    assert.equal(numberToVietnamese(5), "năm");
    assert.equal(numberToVietnamese(10), "mười");
    assert.equal(numberToVietnamese(15), "mười lăm");
    assert.equal(numberToVietnamese(21), "hai mươi mốt");
    assert.equal(numberToVietnamese(25), "hai mươi lăm");
    assert.equal(numberToVietnamese(105), "một trăm linh năm");
    assert.equal(numberToVietnamese(1000), "một nghìn");
  });
  it("keeps a zero hundreds column audible inside a group", () => {
    // Drop the "không trăm" and this reads back as 1.050, not 1.005.
    assert.equal(numberToVietnamese(1005), "một nghìn không trăm linh năm");
    assert.equal(numberToVietnamese(1050), "một nghìn không trăm năm mươi");
  });
  it("skips empty groups without losing their scale", () => {
    assert.equal(numberToVietnamese(1_000_000), "một triệu");
    assert.equal(numberToVietnamese(900_000), "chín trăm nghìn");
    assert.equal(numberToVietnamese(1_200_000), "một triệu hai trăm nghìn");
    assert.equal(numberToVietnamese(2_000_000_000), "hai tỷ");
  });
  it("formats the invoice line", () => {
    assert.equal(vndInWords(900_000), "Chín trăm nghìn đồng./.");
    assert.equal(vndInWords(0), "Không đồng./.");
    assert.equal(vndInWords(-50_000), "Âm năm mươi nghìn đồng./.");
  });
});
