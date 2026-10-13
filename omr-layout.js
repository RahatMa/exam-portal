/* =========================================================
   OMR SHEET GEOMETRY — shared by omr-sheet.html (printing)
   and omr-scan.js (camera reading).

   All numbers are millimetres on an A4 page (210 × 297 mm).
   DO NOT CHANGE anything here after books are printed:
   the scanner finds bubbles using exactly these numbers.
   ========================================================= */
(function (global) {
  'use strict';

  const PAGE = { w: 210, h: 297 };

  // Four solid black squares. The scanner lines the page up with their centres.
  // Order: top-left, top-right, bottom-right, bottom-left (clockwise).
  const MARK_SIZE = 10;
  const MARKS = [[14, 14], [196, 14], [196, 283], [14, 283]];

  // Exam QR code (top-right of the header). QUIET adds blank margin around it.
  const QR = { x: 168, y: 24, size: 22, quiet: 3 };

  const BUBBLE_R = 2.7;   // bubble radius
  const OPT_PITCH = 7.2;  // distance between bubble centres in a row
  const NUM_W = 9;        // space for the question number
  const ROW_PITCH = 7.6;  // distance between rows
  const GROUP_GAP = 2.4;  // extra space after every 5 rows
  const COL_PITCH = 43;   // distance between columns
  const GRID_TOP = 80;    // centre of the first row
  const MAX_Q = 100;

  function columnsFor(n) {
    return n <= 15 ? 1 : n <= 50 ? 2 : n <= 75 ? 3 : 4;
  }

  // Returns every bubble position for an exam with n questions.
  function layout(n) {
    n = Math.max(1, Math.min(MAX_Q, Math.floor(n)));
    const cols = columnsFor(n);
    const perCol = Math.ceil(n / cols);
    const colW = NUM_W + 3 * OPT_PITCH + 2 * BUBBLE_R;
    const totalW = (cols - 1) * COL_PITCH + colW;
    const left = PAGE.w / 2 - totalW / 2;
    const questions = [];
    for (let i = 0; i < n; i++) {
      const c = Math.floor(i / perCol), r = i % perCol;
      const x0 = left + c * COL_PITCH;
      const y = GRID_TOP + r * ROW_PITCH + Math.floor(r / 5) * GROUP_GAP;
      const bubbles = [0, 1, 2, 3].map(function (j) {
        return { x: x0 + NUM_W + BUBBLE_R + j * OPT_PITCH, y: y };
      });
      questions.push({ index: i, col: c, row: r, numX: x0 + NUM_W - 1.2, y: y, bubbles: bubbles });
    }
    const lastRowY = GRID_TOP + (perCol - 1) * ROW_PITCH + Math.floor((perCol - 1) / 5) * GROUP_GAP;
    return {
      n: n, cols: cols, perCol: perCol, left: left, colW: colW, totalW: totalW,
      top: GRID_TOP - ROW_PITCH / 2 - 3, bottom: lastRowY + ROW_PITCH / 2 + 1,
      questions: questions,
    };
  }

  // Text stored in the exam QR code, e.g. "OMR1:PHY-01:20".
  function qrText(examId, n) { return 'OMR1:' + String(examId).toUpperCase() + ':' + n; }
  function parseQr(text) {
    const m = /^OMR1:([A-Z0-9_.-]+):(\d{1,3})$/.exec(String(text || '').trim());
    return m ? { examId: m[1], n: parseInt(m[2], 10) } : null;
  }

  global.OMR_LAYOUT = {
    PAGE: PAGE, MARK_SIZE: MARK_SIZE, MARKS: MARKS, QR: QR, BUBBLE_R: BUBBLE_R,
    OPT_PITCH: OPT_PITCH, ROW_PITCH: ROW_PITCH, MAX_Q: MAX_Q,
    layout: layout, qrText: qrText, parseQr: parseQr,
  };
})(typeof window !== 'undefined' ? window : globalThis);
