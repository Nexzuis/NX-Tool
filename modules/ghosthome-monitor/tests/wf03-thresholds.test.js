'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { getStaleThresholdMs } = require('../wf03-analytics');

describe('WF-03 getStaleThresholdMs', () => {
  // The function reads the current wall-clock time in SAST.
  // We can't easily mock Date, but we can verify the return type
  // and test by temporarily overriding toLocaleString.
  // Simpler approach: patch Date prototype for controlled tests.

  function withSastHour(hour, fn) {
    const original = Date.prototype.toLocaleString;
    Date.prototype.toLocaleString = function (locale, options) {
      if (options && options.timeZone === 'Africa/Johannesburg' && options.hour === 'numeric') {
        return String(hour);
      }
      return original.call(this, locale, options);
    };
    try {
      fn();
    } finally {
      Date.prototype.toLocaleString = original;
    }
  }

  it('returns 3600000 (1 hour) during business hours 06:00-17:00 SAST', () => {
    for (const hour of [6, 10, 12, 17]) {
      withSastHour(hour, () => {
        assert.equal(getStaleThresholdMs(), 3600000,
          `Expected 3600000 at hour ${hour}`);
      });
    }
  });

  it('returns 7200000 (2 hours) during evening 18:00-22:00 SAST', () => {
    for (const hour of [18, 20, 22]) {
      withSastHour(hour, () => {
        assert.equal(getStaleThresholdMs(), 7200000,
          `Expected 7200000 at hour ${hour}`);
      });
    }
  });

  it('returns null during quiet hours 23:00-05:59 SAST', () => {
    for (const hour of [23, 0, 1, 3, 5]) {
      withSastHour(hour, () => {
        assert.equal(getStaleThresholdMs(), null,
          `Expected null at hour ${hour}`);
      });
    }
  });
});
