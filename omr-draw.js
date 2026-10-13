/* =========================================================
   Draws the A5 OMR answer sheet as SVG.
   Shared by omr-sheet.html and print.html. Needs omr-layout.js
   and the qrcode-generator library.
   ========================================================= */
(function (global) {
  'use strict';
  const L = global.OMR_LAYOUT;
  const bn = v => String(v).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LABELS = ['ক', 'খ', 'গ', 'ঘ'];
  const SANS = "'Hind Siliguri','Noto Sans Bengali',sans-serif";
  const SERIF = "'Noto Serif Bengali','Hind Siliguri',serif";

  // o: { examId, examName, n, book, site, ink: 'pink' | 'grey' }
  // Returns the SVG text, or throws an Error with a message for the user.
  function svg(o) {
    if (!L || L.PAGE.w !== 148 || !L.WHITE_SPOTS) throw new Error('omr-layout.js on your website is an old version. Upload the new omr-layout.js to GitHub, wait a minute, then reload with Ctrl+Shift+R (Cmd+Shift+R on Mac).');
    if (typeof global.qrcode !== 'function') throw new Error('The QR code library did not load. Check the internet connection and reload.');
    const examId = String(o.examId || '').trim().toUpperCase().replace(/\s+/g, '');
    const n = parseInt(o.n, 10);
    if (!/^[A-Z0-9_.-]+$/.test(examId)) throw new Error('Exam ID: use only letters, numbers and - _ .');
    if (!(n >= 1 && n <= L.MAX_Q)) throw new Error('Number of questions must be 1 to ' + L.MAX_Q + ' on an A5 sheet.');
    let site = String(o.site || '').trim();
    if (!/^https:\/\/[^\s]+$/.test(site)) throw new Error('Enter your website address, starting with https://');
    if (!site.endsWith('/')) site += '/';
    const ink = o.ink === 'grey' ? '#b4b4b4' : '#e8799d';
    const inkText = o.ink === 'grey' ? '#777' : '#c2557c';
    const g = L.layout(n);
    const R = L.BUBBLE_R;
    const out = [];
    const t = (x, y, size, text, opts = {}) => out.push(
      `<text x="${x}" y="${y}" font-size="${size}" font-family="${opts.serif ? SERIF : SANS}" font-weight="${opts.bold ? 700 : 400}" fill="${opts.fill || '#1d2026'}" text-anchor="${opts.anchor || 'start'}">${esc(text)}</text>`);

    // corner squares
    L.MARKS.forEach(([x, y]) => out.push(`<rect x="${x - L.MARK_SIZE / 2}" y="${y - L.MARK_SIZE / 2}" width="${L.MARK_SIZE}" height="${L.MARK_SIZE}" fill="#000"/>`));

    // header
    t(18, 20, 4.3, o.book, { serif: true, bold: true });
    t(18, 25.6, 3.3, o.examName, { bold: true });
    t(18, 30.6, 2.6, `পরীক্ষা কোড: ${examId}`, { fill: '#4a4f57' });
    t(62, 30.6, 2.6, `মোট প্রশ্ন: ${bn(n)}টি`, { fill: '#4a4f57' });
    t(18, 36.6, 2.7, 'নাম:');
    out.push(`<line x1="24.5" y1="37.1" x2="82" y2="37.1" stroke="#9aa0a8" stroke-width=".22"/>`);
    t(85, 36.6, 2.7, 'তারিখ:');
    out.push(`<line x1="94" y1="37.1" x2="112" y2="37.1" stroke="#9aa0a8" stroke-width=".22"/>`);

    // instructions
    out.push(`<rect x="18" y="40.5" width="112" height="13" rx="1.2" fill="none" stroke="${ink}" stroke-width=".3"/>`);
    t(20, 44.6, 2.25, '• কালো/নীল কলম বা HB/2B পেন্সিলে বৃত্ত পুরো ভরাট করুন।');
    t(20, 48.1, 2.25, '• প্রতি প্রশ্নে একটি বৃত্ত। লাল কালি ব্যবহার করবেন না।');
    t(20, 51.6, 2.25, '• স্ক্যানের সময় চার কোণের কালো বর্গ যেন দেখা যায়।');
    t(101, 45.3, 2.3, 'সঠিক:', { anchor: 'end' });
    out.push(`<circle cx="105" cy="44.5" r="2" fill="#222"/>`);
    t(101, 50.9, 2.3, 'ভুল:', { anchor: 'end' });
    [105, 111, 117, 123].forEach((x, i) => {
      const y = 50.1, r = 2;
      out.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${ink}" stroke-width=".25"/>`);
      if (i === 0) out.push(`<path d="M${x - 1.1} ${y + 0.1} l.8 .9 l1.5 -1.9" fill="none" stroke="#444" stroke-width=".38"/>`);
      if (i === 1) out.push(`<path d="M${x - 1} ${y - 1} l2 2 M${x + 1} ${y - 1} l-2 2" stroke="#444" stroke-width=".38"/>`);
      if (i === 2) out.push(`<path d="M${x} ${y - r} A${r} ${r} 0 0 0 ${x} ${y + r} Z" fill="#555"/>`);
      if (i === 3) out.push(`<circle cx="${x}" cy="${y}" r=".75" fill="#555"/>`);
    });

    // QR code with the exam ID and question count
    const qr = qrcode(0, 'M');
    qr.addData(L.qrText(examId, n, site));
    qr.make();
    const m = qr.getModuleCount(), cell = L.QR.size / m;
    let path = '';
    for (let r = 0; r < m; r++) for (let c = 0; c < m; c++) {
      if (qr.isDark(r, c)) path += `M${(L.QR.x + c * cell).toFixed(3)} ${(L.QR.y + r * cell).toFixed(3)}h${cell.toFixed(3)}v${cell.toFixed(3)}h-${cell.toFixed(3)}z`;
    }
    out.push(`<path d="${path}" fill="#000"/>`);

    // answer grid
    for (let c = 0; c < g.cols; c++) {
      const x0 = g.left + c * g.colPitch;
      out.push(`<rect x="${(x0 - 2.2).toFixed(2)}" y="${g.top.toFixed(2)}" width="${(g.colW + 4.4).toFixed(2)}" height="${(g.bottom - g.top).toFixed(2)}" rx="1.2" fill="none" stroke="${ink}" stroke-width=".3"/>`);
    }
    g.questions.forEach(q => {
      t(q.numX, q.y + 0.95, 2.7, bn(q.index + 1), { anchor: 'end', bold: true, fill: '#333' });
      q.bubbles.forEach((b, j) => {
        out.push(`<circle cx="${b.x.toFixed(2)}" cy="${b.y.toFixed(2)}" r="${R}" fill="none" stroke="${ink}" stroke-width=".27"/>`);
        out.push(`<text x="${b.x.toFixed(2)}" y="${(b.y + 0.8).toFixed(2)}" font-size="2.3" font-family="${SANS}" fill="${ink}" text-anchor="middle">${LABELS[j]}</text>`);
      });
      if (q.row % 5 === 4 && q.row !== g.perCol - 1 && q.index !== g.n - 1) {
        const y = q.y + L.ROW_PITCH / 2 + L.GROUP_GAP / 2;
        const x0 = g.left + q.col * g.colPitch;
        out.push(`<line x1="${(x0 - 1).toFixed(2)}" y1="${y.toFixed(2)}" x2="${(x0 + g.colW + 1).toFixed(2)}" y2="${y.toFixed(2)}" stroke="${ink}" stroke-width=".22" stroke-dasharray=".9 .9"/>`);
      }
    });

    t(74, 201.2, 2.2, 'পাতা ভাঁজ করবেন না। কোণের কালো বর্গে দাগ দেবেন না।', { anchor: 'middle', fill: inkText });

    return `<svg xmlns="http://www.w3.org/2000/svg" width="148mm" height="210mm" viewBox="0 0 148 210"><rect width="148" height="210" fill="#fff"/>${out.join('')}</svg>`;
  }

  global.OMR_DRAW = { svg: svg };
})(window);
