/* =========================================================
   OMR SHEET GEOMETRY (A5) — shared by omr-sheet.html (printing)
   and omr-scan.js (camera reading).

   All numbers are millimetres on an A5 page (148 × 210 mm).
   DO NOT CHANGE anything here after books are printed:
   the scanner finds bubbles using exactly these numbers.
   ========================================================= */
(function (global) {
  'use strict';

  const VERSION = 2;                 // printed inside the QR code as "OMR2"
  const PAGE = { w: 148, h: 210 };

  // Four solid black squares. The scanner lines the page up with their centres.
  // Order: top-left, top-right, bottom-right, bottom-left (clockwise).
  const MARK_SIZE = 8;
  const MARKS = [[10, 10], [138, 10], [138, 200], [10, 200]];

  // Blank paper spots next to the squares, used to measure the light.
  const WHITE_SPOTS = [[6, 20], [142, 40], [142, 190], [6, 190]];

  // Exam QR code (top-right of the header). quiet = blank margin around it.
  const QR = { x: 117, y: 17, size: 17, quiet: 2.5 };

  const BUBBLE_R = 2.3;    // bubble radius (4.6 mm circle)
  const OPT_PITCH = 6.0;   // distance between bubble centres in a row
  const NUM_W = 7.5;       // space for the question number
  const ROW_PITCH = 6.4;   // distance between rows
  const GROUP_GAP = 1.8;   // extra space after every 5 rows
  const COL_PITCH = 36;    // distance between columns
  const GRID_TOP = 61;     // centre of the first row
  const MAX_ROWS = 20;
  const MAX_Q = 60;

  function columnsFor(n) { return n <= 12 ? 1 : n <= 40 ? 2 : 3; }

  // Returns every bubble position for an exam with n questions.
  function layout(n) {
    n = Math.max(1, Math.min(MAX_Q, Math.floor(n)));
    const cols = columnsFor(n);
    const perCol = Math.ceil(n / cols);
    const colW = NUM_W + 3 * OPT_PITCH + 2 * BUBBLE_R;
    const totalW = (cols - 1) * COL_PITCH + colW;
    const left = PAGE.w / 2 - totalW / 2;
    const rowY = r => GRID_TOP + r * ROW_PITCH + Math.floor(r / 5) * GROUP_GAP;
    const questions = [];
    for (let i = 0; i < n; i++) {
      const c = Math.floor(i / perCol), r = i % perCol;
      const x0 = left + c * COL_PITCH;
      const y = rowY(r);
      const bubbles = [0, 1, 2, 3].map(j => ({ x: x0 + NUM_W + BUBBLE_R + j * OPT_PITCH, y: y }));
      questions.push({ index: i, col: c, row: r, numX: x0 + NUM_W - 1, y: y, bubbles: bubbles });
    }
    return {
      n: n, cols: cols, perCol: perCol, left: left, colW: colW, totalW: totalW,
      colPitch: COL_PITCH, rowY: rowY,
      top: GRID_TOP - ROW_PITCH / 2 - 2, bottom: rowY(perCol - 1) + ROW_PITCH / 2 + 1,
      questions: questions,
    };
  }

  // The exam QR code holds a link that opens this exam in the portal, e.g.
  //   https://exam.yourdomain.com/?e=PHY-01&q=20
  // (q = number of questions). The scanner reads the same link to check the sheet.
  function qrText(examId, n, siteUrl) {
    const id = String(examId).toUpperCase();
    if (!siteUrl) return 'OMR' + VERSION + ':' + id + ':' + n;
    let base = String(siteUrl).trim();
    if (!/\/$/.test(base) && !/\.html?$/i.test(base)) base += '/';
    return base + '?e=' + encodeURIComponent(id) + '&q=' + n + (VERSION > 2 ? '&v=' + VERSION : '');
  }
  function parseQr(text) {
    text = String(text || '').trim();
    let m = /^OMR(\d):([A-Z0-9_.-]+):(\d{1,3})$/.exec(text);
    if (m) return { version: parseInt(m[1], 10), examId: m[2], n: parseInt(m[3], 10) };
    const e = /[?&]e=([A-Za-z0-9_.-]+)/.exec(text), q = /[?&]q=(\d{1,3})/.exec(text), v = /[?&]v=(\d+)/.exec(text);
    if (e && q) return { version: v ? parseInt(v[1], 10) : 2, examId: e[1].toUpperCase(), n: parseInt(q[1], 10) };
    return null;
  }

  global.OMR_LAYOUT = {
    VERSION: VERSION, PAGE: PAGE, MARK_SIZE: MARK_SIZE, MARKS: MARKS, WHITE_SPOTS: WHITE_SPOTS, QR: QR,
    BUBBLE_R: BUBBLE_R, OPT_PITCH: OPT_PITCH, ROW_PITCH: ROW_PITCH, GROUP_GAP: GROUP_GAP, MAX_Q: MAX_Q,
    layout: layout, qrText: qrText, parseQr: parseQr,
  };
})(typeof window !== 'undefined' ? window : globalThis);
