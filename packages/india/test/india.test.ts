import {
  isValidUpiVpa,
  normalizeUpiVpa,
  formatINR,
  rupeesToPaise,
  paiseToRupees,
  computeGst,
  GST_RATES,
  formatIST,
  isIndiaBusinessHour,
  IST_OFFSET_MINUTES,
  isValidAadhaar,
  maskAadhaar,
  isValidPan,
  isValidPinCode,
  normalizeIndianMobile,
  redactIndianPII,
  toDevanagariDigits,
  toHindiAmountWord,
  festivalOn,
  istGreeting
} from '../src/index';

describe('UPI VPA', () => {
  it.each([
    'ajay@oksbi',
    '9876543210@ybl',
    'firm.gst@hdfcbank',
    'a.b_c-d@paytm',
    'AJAY@OKSBI' // accepted via normalization
  ])('accepts %s', (vpa) => {
    expect(isValidUpiVpa(vpa)).toBe(true);
  });

  it.each([
    '',
    'no-at-sign',
    '@oksbi',
    'ajay@',
    'ajay@1bank', // PSP must start with a letter
    'a@x', // PSP too short
    'a'.repeat(300) + '@oksbi'
  ])('rejects %s', (vpa) => {
    expect(isValidUpiVpa(vpa)).toBe(false);
  });

  it('normalizes case and whitespace', () => {
    expect(normalizeUpiVpa('  AJAY@OKSBI  ')).toBe('ajay@oksbi');
    expect(normalizeUpiVpa('garbage')).toBeNull();
  });
});

describe('INR formatting', () => {
  it('formats with Indian numbering and paise', () => {
    expect(formatINR(0)).toBe('₹0.00');
    expect(formatINR(99)).toBe('₹0.99');
    expect(formatINR(100)).toBe('₹1.00');
    expect(formatINR(123456)).toBe('₹1,234.56');
    expect(formatINR(10_000_000)).toBe('₹1,00,000.00'); // 1 lakh rupees
    expect(formatINR(1_00_00_00_000)).toBe('₹1,00,00,000.00'); // 1 crore rupees
    expect(formatINR(10_00_00_00_000)).toBe('₹10,00,00,000.00'); // 10 crore rupees
  });

  it('respects symbol/decimals options', () => {
    expect(formatINR(123456, { symbol: false })).toBe('1,234.56');
    expect(formatINR(123456, { decimals: false })).toBe('₹1,234');
  });

  it('handles negatives', () => {
    expect(formatINR(-12345)).toBe('-₹123.45');
  });

  it('round-trips rupees ↔ paise without float drift', () => {
    expect(rupeesToPaise(19.99)).toBe(1999);
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30);
    expect(paiseToRupees(1999)).toBeCloseTo(19.99, 2);
  });

  it('rejects non-finite input', () => {
    expect(() => formatINR(NaN)).toThrow(RangeError);
    expect(() => rupeesToPaise(Infinity)).toThrow(RangeError);
    expect(() => paiseToRupees(NaN)).toThrow(RangeError);
  });
});

describe('GST', () => {
  it('intra-state splits CGST + SGST evenly and exactly', () => {
    const b = computeGst(100_00, 18); // ₹100
    expect(b.gstPaise).toBe(1800);
    expect(b.cgstPaise + b.sgstPaise).toBe(b.gstPaise);
    expect(b.cgstPaise).toBe(900);
    expect(b.sgstPaise).toBe(900);
    expect(b.totalPaise).toBe(11800);
    expect(b.interState).toBe(false);
  });

  it('inter-state uses IGST only', () => {
    const b = computeGst(100_00, 18, { interState: true });
    expect(b.igstPaise).toBe(1800);
    expect(b.cgstPaise).toBe(0);
    expect(b.sgstPaise).toBe(0);
    expect(b.interState).toBe(true);
  });

  it('handles odd-paise rounding so CGST + SGST = GST', () => {
    // 5% on 333 paise = 16.65 → 17 paise; 17/2 = 8 cgst + 9 sgst.
    const b = computeGst(333, 5);
    expect(b.gstPaise).toBe(17);
    expect(b.cgstPaise + b.sgstPaise).toBe(17);
  });

  it.each(GST_RATES)('accepts standard GST rate %i', (rate) => {
    expect(() => computeGst(1000, rate)).not.toThrow();
  });

  it('rejects bad inputs', () => {
    expect(() => computeGst(-1, 18)).toThrow(RangeError);
    expect(() => computeGst(1.5, 18)).toThrow(RangeError);
    // @ts-expect-error invalid rate at compile time; assert runtime guard
    expect(() => computeGst(100, 7)).toThrow(RangeError);
  });
});

describe('IST helpers', () => {
  it('IST is UTC+05:30', () => {
    expect(IST_OFFSET_MINUTES).toBe(330);
  });

  it('formats a known UTC instant correctly in IST', () => {
    // 2024-01-26T00:00:00Z → 2024-01-26 05:30 IST
    expect(formatIST(new Date('2024-01-26T00:00:00Z'))).toBe('2024-01-26 05:30 IST');
    // 2024-08-14T19:00:00Z → 2024-08-15 00:30 IST (date boundary)
    expect(formatIST(new Date('2024-08-14T19:00:00Z'))).toBe('2024-08-15 00:30 IST');
  });

  it('rejects invalid Date', () => {
    expect(() => formatIST(new Date('not-a-date'))).toThrow(RangeError);
  });

  it('isIndiaBusinessHour bounds at 09:00 and 21:00 IST', () => {
    // 03:30 UTC = 09:00 IST → true
    expect(isIndiaBusinessHour(new Date('2024-01-01T03:30:00Z'))).toBe(true);
    // 15:30 UTC = 21:00 IST → false (exclusive)
    expect(isIndiaBusinessHour(new Date('2024-01-01T15:30:00Z'))).toBe(false);
    // 02:00 UTC = 07:30 IST → false
    expect(isIndiaBusinessHour(new Date('2024-01-01T02:00:00Z'))).toBe(false);
  });
});

describe('Aadhaar / PAN / PIN / mobile', () => {
  it('validates and masks Aadhaar', () => {
    expect(isValidAadhaar('234567890123')).toBe(true);
    expect(isValidAadhaar('2345 6789 0123')).toBe(true);
    expect(isValidAadhaar('1234 5678 9012')).toBe(false); // starts with 1
    expect(isValidAadhaar('023456789012')).toBe(false); // starts with 0
    expect(isValidAadhaar('234')).toBe(false);
    expect(maskAadhaar('2345 6789 0123')).toBe('XXXX-XXXX-0123');
    expect(maskAadhaar('bad')).toBeNull();
  });

  it('validates PAN', () => {
    expect(isValidPan('ABCDE1234F')).toBe(true);
    expect(isValidPan('abcde1234f')).toBe(true);
    expect(isValidPan('ABCD1234F')).toBe(false);
    expect(isValidPan('ABCDE12345')).toBe(false);
  });

  it('validates PIN code', () => {
    expect(isValidPinCode('560001')).toBe(true);
    expect(isValidPinCode(110001)).toBe(true);
    expect(isValidPinCode('060001')).toBe(false); // starts with 0
    expect(isValidPinCode('12345')).toBe(false);
    expect(isValidPinCode('abcdef')).toBe(false);
  });

  it('normalizes Indian mobile numbers', () => {
    expect(normalizeIndianMobile('9876543210')).toBe('+919876543210');
    expect(normalizeIndianMobile('+91 98765 43210')).toBe('+919876543210');
    expect(normalizeIndianMobile('919876543210')).toBe('+919876543210');
    expect(normalizeIndianMobile('09876543210')).toBe('+919876543210');
    expect(normalizeIndianMobile('(98765) 43210')).toBe('+919876543210');
    expect(normalizeIndianMobile('5876543210')).toBeNull(); // leading 5 invalid
    expect(normalizeIndianMobile('123')).toBeNull();
  });
});

describe('PII redaction', () => {
  it('redacts Aadhaar and PAN occurrences in text', () => {
    const out = redactIndianPII(
      'My Aadhaar is 2345 6789 0123 and PAN is ABCDE1234F please verify.'
    );
    expect(out).toContain('[redacted-aadhaar]');
    expect(out).toContain('[redacted-pan]');
    expect(out).not.toContain('2345 6789 0123');
    expect(out).not.toContain('ABCDE1234F');
  });

  it('leaves non-PII text untouched', () => {
    expect(redactIndianPII('hello world')).toBe('hello world');
  });
});

describe('Hindi helpers', () => {
  it('converts to Devanagari digits', () => {
    expect(toDevanagariDigits(2024)).toBe('२०२४');
    expect(toDevanagariDigits('₹1,234.56')).toBe('₹१,२३४.५६');
  });

  it('formats amounts in Hindi short-scale', () => {
    expect(toHindiAmountWord(99_999)).toBe('99999');
    expect(toHindiAmountWord(1_00_000)).toBe('1 लाख');
    expect(toHindiAmountWord(12_50_000)).toBe('12.5 लाख');
    expect(toHindiAmountWord(1_00_00_000)).toBe('1 करोड़');
    expect(toHindiAmountWord(2_50_00_00_000)).toBe('250 करोड़');
  });

  it('rejects negative or non-finite amounts', () => {
    expect(() => toHindiAmountWord(-1)).toThrow(RangeError);
    expect(() => toHindiAmountWord(NaN)).toThrow(RangeError);
  });
});

describe('festivalOn / istGreeting', () => {
  it('detects Republic Day and Independence Day in IST', () => {
    // 2024-01-25T20:00:00Z → 2024-01-26 01:30 IST → Republic Day
    expect(festivalOn(new Date('2024-01-25T20:00:00Z'))?.name).toBe('Republic Day');
    expect(festivalOn(new Date('2024-08-15T06:00:00Z'))?.nameHi).toBe('स्वतंत्रता दिवस');
    expect(festivalOn(new Date('2024-03-15T06:00:00Z'))).toBeNull();
  });

  it('returns time-appropriate greeting in en/hi', () => {
    // 04:00 UTC = 09:30 IST → morning
    const morning = new Date('2024-01-01T04:00:00Z');
    expect(istGreeting('en', morning)).toBe('Good morning');
    expect(istGreeting('hi', morning)).toBe('सुप्रभात');

    // 08:00 UTC = 13:30 IST → afternoon
    expect(istGreeting('en', new Date('2024-01-01T08:00:00Z'))).toBe('Good afternoon');
    expect(istGreeting('hi', new Date('2024-01-01T08:00:00Z'))).toBe('नमस्कार');

    // 13:00 UTC = 18:30 IST → evening
    expect(istGreeting('en', new Date('2024-01-01T13:00:00Z'))).toBe('Good evening');

    // 23:00 UTC = 04:30 IST → fallback
    expect(istGreeting('en', new Date('2024-01-01T23:00:00Z'))).toBe('Hello');
    expect(istGreeting('hi', new Date('2024-01-01T23:00:00Z'))).toBe('नमस्ते');
  });

  it('handles invalid date gracefully', () => {
    expect(istGreeting('en', new Date('not-a-date'))).toBe('Hello');
    expect(istGreeting('hi', new Date('not-a-date'))).toBe('नमस्ते');
  });
});
