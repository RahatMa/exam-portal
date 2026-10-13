/* =========================================================
   CAMERA OMR SCANNER
   Runs entirely in the student's browser. Needs omr-layout.js.

   How it reads a sheet:
   1. Find the four black corner squares.
   2. Work out how the page is tilted (a "homography").
   3. Use the QR code position to tell which way up the page is.
   4. Measure how dark each bubble is, using the red colour channel
      so the pink printed bubbles almost disappear and only
      pencil / pen marks count.
   ========================================================= */
(function (global) {
  'use strict';
  const L = global.OMR_LAYOUT;
  const JSQR_URL = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
  const DETECT_MAX = 900;          // detection works on a picture this many pixels wide/high

  const FLAG_TEXT = {
    multiple: 'একাধিক বৃত্ত ভরাট',
    light: 'হালকা দাগ',
    unclear: 'দাগ স্পষ্ট নয়',
    check: 'মোছা দাগ থাকতে পারে',
  };

  /* ---------------- maths ---------------- */

  // Solve for H so that H * (x, y, 1) ~ (u, v, 1) for 4 point pairs.
  function homography(src, dst) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i], [u, v] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    const n = 8;
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      if (Math.abs(A[p][c]) < 1e-12) return null;
      [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = A[r][c] / A[c][c];
        if (!f) continue;
        for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
        b[r] -= f * b[c];
      }
    }
    const h = b.map((v, i) => v / A[i][i]);
    return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
  }
  function project(H, x, y) {
    const w = H[6] * x + H[7] * y + H[8];
    return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
  }

  /* ---------------- image helpers ---------------- */

  function luminance(img) {
    const { data, width, height } = img;
    const out = new Uint8Array(width * height);
    for (let i = 0, j = 0; j < out.length; i += 4, j++) out[j] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
    return out;
  }

  // Bilinear sample of one colour channel (0 = red).
  function sample(img, x, y, ch) {
    const { data, width, height } = img;
    if (x < 0 || y < 0 || x > width - 1.001 || y > height - 1.001) return 255;
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0;
    const i = (y0 * width + x0) * 4 + ch;
    const a = data[i], b = data[i + 4], c = data[i + width * 4], d = data[i + width * 4 + 4];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }

  /* ---------------- step 1: corner squares ---------------- */

  function detectMarkers(lum, w, h) {
    let last = null;
    for (const k of [0.72, 0.8, 0.64]) {
      last = detectMarkersAt(lum, w, h, k);
      if (last.corners) return last;
    }
    return last;
  }

  function detectMarkersAt(lum, w, h, factor) {
    // adaptive threshold: a pixel is "dark" if clearly darker than its neighbourhood
    const W = w + 1, S = new Float64Array(W * (h + 1));
    for (let y = 0; y < h; y++) {
      let row = 0;
      for (let x = 0; x < w; x++) { row += lum[y * w + x]; S[(y + 1) * W + x + 1] = S[y * W + x + 1] + row; }
    }
    const r = Math.max(8, Math.round(Math.max(w, h) / 14));
    const bin = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
        const sum = S[y1 * W + x1] - S[y0 * W + x1] - S[y1 * W + x0] + S[y0 * W + x0];
        const mean = sum / ((x1 - x0) * (y1 - y0));
        if (lum[y * w + x] < mean * factor) bin[y * w + x] = 1;
      }
    }

    // connected dark blobs
    const label = new Int32Array(w * h);
    const stack = new Int32Array(w * h);
    const minA = Math.max(25, w * h * 0.00005), maxA = w * h * 0.02;
    const cands = [];
    let next = 1;
    for (let p = 0; p < w * h; p++) {
      if (!bin[p] || label[p]) continue;
      let sp = 0, cnt = 0, sx = 0, sy = 0, minx = w, maxx = 0, miny = h, maxy = 0;
      stack[sp++] = p; label[p] = next;
      while (sp) {
        const q = stack[--sp], qx = q % w, qy = (q / w) | 0;
        cnt++; sx += qx; sy += qy;
        if (qx < minx) minx = qx; if (qx > maxx) maxx = qx; if (qy < miny) miny = qy; if (qy > maxy) maxy = qy;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = qx + dx, ny = qy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const nq = ny * w + nx;
          if (bin[nq] && !label[nq]) { label[nq] = next; stack[sp++] = nq; }
        }
      }
      next++;
      const bw = maxx - minx + 1, bh = maxy - miny + 1;
      if (cnt < minA || cnt > maxA) continue;
      if (minx === 0 || miny === 0 || maxx === w - 1 || maxy === h - 1) continue;
      const aspect = bw / bh, fill = cnt / (bw * bh);
      if (aspect < 0.5 || aspect > 2 || fill < 0.55) continue;
      cands.push({ x: sx / cnt, y: sy / cnt, area: cnt });
    }
    if (cands.length < 4) return { bin: bin, corners: null };

    cands.sort((a, b) => b.area - a.area);
    const top = cands.slice(0, 24);
    const pick = f => top.reduce((best, c) => (f(c) > f(best) ? c : best), top[0]);
    const tl = pick(c => -(c.x + c.y)), br = pick(c => c.x + c.y);
    const tr = pick(c => c.x - c.y), bl = pick(c => c.y - c.x);
    const quad = [tl, tr, br, bl];
    if (new Set(quad).size < 4) return { bin: bin, corners: null };

    // sanity checks: similar sizes, page-like shape, square size fits the page
    const areas = quad.map(c => c.area);
    if (Math.max(...areas) / Math.min(...areas) > 3.2) return { bin: bin, corners: null };
    const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const s1 = (d(tl, tr) + d(bl, br)) / 2, s2 = (d(tl, bl) + d(tr, br)) / 2;
    const long = Math.max(s1, s2), short = Math.min(s1, s2);
    const ratio = long / short;   // the page's marker rectangle is 269 : 182 = 1.48
    if (ratio < 1.15 || ratio > 1.95) return { bin: bin, corners: null };
    const side = Math.sqrt(areas.reduce((a, b) => a + b, 0) / 4) / short; // expected 10/182 = 0.055
    if (side < 0.025 || side > 0.11) return { bin: bin, corners: null };
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const signs = [cross(tl, tr, br), cross(tr, br, bl), cross(br, bl, tl), cross(bl, tl, tr)].map(Math.sign);
    if (!signs.every(s => s === signs[0])) return { bin: bin, corners: null };
    return { bin: bin, corners: quad.map(c => [c.x, c.y]) };
  }

  /* ---------------- step 2–3: which way up ---------------- */

  function orient(corners, bin, w, h) {
    let best = null;
    for (let rot = 0; rot < 4; rot++) {
      const dst = [0, 1, 2, 3].map(k => corners[(k + rot) % 4]);
      const H = homography(L.MARKS, dst);
      if (!H) continue;
      let dark = 0, total = 0;
      for (let i = 0; i < 14; i++) for (let j = 0; j < 14; j++) {
        const [px, py] = project(H, L.QR.x + (i + 0.5) * L.QR.size / 14, L.QR.y + (j + 0.5) * L.QR.size / 14);
        const x = Math.round(px), y = Math.round(py);
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        total++; dark += bin[y * w + x];
      }
      const score = total ? dark / total : 0;
      if (!best || score > best.score) best = { rot: rot, score: score, dst: dst };
    }
    return best && best.score > 0.22 ? best : null;
  }

  /* ---------------- step 4: bubbles ---------------- */

  const DISC = (function () {
    const pts = [];
    const R = L.BUBBLE_R * 0.62;
    for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) {
      const dx = i / 4 * R, dy = j / 4 * R;
      if (dx * dx + dy * dy <= R * R) pts.push([dx, dy]);
    }
    return pts;
  })();

  // Average red value in a small disc (mm radius r) around a page point.
  function discMean(img, H, cx, cy, pts) {
    let s = 0;
    for (const [ox, oy] of pts) { const [x, y] = project(H, cx + ox, cy + oy); s += sample(img, x, y, 0); }
    return s / pts.length;
  }
  const SPOT = [[0, 0], [-0.4, 0], [0.4, 0], [0, -0.3], [0, 0.3]];
  const MARK_PTS = (function () {
    const p = [], r = L.MARK_SIZE * 0.3;
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) p.push([i / 2 * r, j / 2 * r]);
    return p;
  })();

  // How dark the printed black squares look in this photo (1 = perfect black).
  // Pencil marks are judged relative to this, so dim or warm light doesn't matter.
  function blackLevel(img, H) {
    const vals = L.MARKS.map(([mx, my], i) => {
      const [wx, wy] = L.WHITE_SPOTS[i];
      const white = discMean(img, H, wx, wy, SPOT);
      const black = discMean(img, H, mx, my, MARK_PTS);
      return white > 20 ? 1 - black / white : 0;
    }).sort((a, b) => a - b);
    return Math.max(0.35, Math.min(1, (vals[1] + vals[2]) / 2));
  }

  // Best split point between two groups of numbers (Otsu's method).
  function otsu(vals) {
    if (vals.length < 8) return null;
    const sorted = vals.slice().sort((a, b) => a - b);
    let best = null, bestScore = -1, sumAll = sorted.reduce((a, b) => a + b, 0), sumLeft = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      sumLeft += sorted[i];
      const nl = i + 1, nr = sorted.length - nl;
      const ml = sumLeft / nl, mr = (sumAll - sumLeft) / nr;
      const score = nl * nr * (mr - ml) * (mr - ml);
      if (score > bestScore) { bestScore = score; best = (sorted[i] + sorted[i + 1]) / 2; }
    }
    return best;
  }

  function readBubbles(img, H, n) {
    const g = L.layout(n);
    const half = L.ROW_PITCH / 2;
    const scale = 1 / blackLevel(img, H);
    const answers = [], flags = [], darkness = [];
    g.questions.forEach(q => {
      // paper white just above and below each bubble (handles shadows across the page)
      const own = q.bubbles.map(b => Math.max(discMean(img, H, b.x, b.y - half, SPOT), discMean(img, H, b.x, b.y + half, SPOT)));
      const rowMax = Math.max(...own);
      const d = q.bubbles.map((b, i) => {
        const white = Math.max(15, own[i], rowMax * 0.7);
        const v = 1 - discMean(img, H, b.x, b.y, DISC) / white;
        return Math.max(0, Math.min(1, v * scale));
      });
      darkness.push(d);
    });

    // Learn from this photo what "filled" and "empty" look like (two groups),
    // so noisy, dim or low-contrast photos get fair thresholds.
    const rels = [];
    darkness.forEach(d => { const m = Math.min(...d); d.forEach(v => rels.push(v - m)); });
    let strongT = 0.24, weakT = 0.12;
    const split = otsu(rels);
    if (split) {
      const empty = rels.filter(v => v <= split), filled = rels.filter(v => v > split);
      const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
      const me = mean(empty), mf = mean(filled);
      const sd = Math.sqrt(mean(empty.map(v => (v - me) * (v - me))));
      if (filled.length >= 1 && mf - me > 0.2) {
        strongT = Math.min(0.4, Math.max(0.15, me + 0.45 * (mf - me)));
        weakT = Math.min(strongT - 0.04, Math.max(0.08, me + 0.2 * (mf - me), me + 3.5 * sd));
      }
    }

    const K = ['A', 'B', 'C', 'D'];
    darkness.forEach(d => {
      const base = Math.min(...d);
      const rel = d.map(v => v - base);
      const strong = [], weak = [];
      rel.forEach((v, i) => { if (v > strongT) strong.push(i); else if (v > weakT) weak.push(i); });
      let ans = '', flag = '';
      if (base > 0.5) { flag = 'multiple'; }
      else if (strong.length === 1 && !weak.length) { ans = K[strong[0]]; }
      else if (strong.length === 1) { ans = K[strong[0]]; flag = 'check'; }
      else if (strong.length > 1) { flag = 'multiple'; }
      else if (weak.length === 1) { ans = K[weak[0]]; flag = 'light'; }
      else if (weak.length > 1) { flag = 'unclear'; }
      answers.push(ans); flags.push(flag);
    });
    return { answers: answers, flags: flags, darkness: darkness };
  }

  // Combine several readings of the same sheet (from a few camera frames).
  function vote(results) {
    if (results.length === 1) return results[0];
    const out = Object.assign({}, results[0], { answers: [], flags: [] });
    results[0].answers.forEach((_, i) => {
      const count = {};
      results.forEach(r => { const k = r.answers[i] + '|' + r.flags[i]; count[k] = (count[k] || 0) + 1; });
      const [best, c] = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
      const [a, f] = best.split('|');
      out.answers.push(a);
      out.flags.push(c === results.length ? f : (f || 'unclear'));
    });
    return out;
  }

  /* ---------------- QR ---------------- */

  function decodeQr(img, H) {
    if (typeof global.jsQR !== 'function') return null;
    const ppm = 10, x0 = L.QR.x - L.QR.quiet, y0 = L.QR.y - L.QR.quiet, mm = L.QR.size + 2 * L.QR.quiet;
    const size = Math.round(mm * ppm);
    const out = new Uint8ClampedArray(size * size * 4);
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const [x, y] = project(H, x0 + (i + 0.5) / ppm, y0 + (j + 0.5) / ppm);
      const k = (j * size + i) * 4;
      const v = (sample(img, x, y, 0) + sample(img, x, y, 1) + sample(img, x, y, 2)) / 3;
      out[k] = out[k + 1] = out[k + 2] = v; out[k + 3] = 255;
    }
    const code = global.jsQR(out, size, size, { inversionAttempts: 'dontInvert' });
    return code ? code.data : null;
  }

  /* ---------------- preview of the straightened page ---------------- */

  function preview(img, H, n, res) {
    if (typeof document === 'undefined') return null;
    const g = L.layout(n);
    const ppm = 4;
    const top = g.top - 3, bottom = Math.min(L.PAGE.h, g.bottom + 3);
    const left = Math.max(0, g.left - 6), right = Math.min(L.PAGE.w, g.left + g.totalW + 6);
    const cw = Math.round((right - left) * ppm), ch = Math.round((bottom - top) * ppm);
    const cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const ctx = cv.getContext('2d');
    const id = ctx.createImageData(cw, ch);
    for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
      const [x, y] = project(H, left + (i + 0.5) / ppm, top + (j + 0.5) / ppm);
      const k = (j * cw + i) * 4;
      id.data[k] = sample(img, x, y, 0); id.data[k + 1] = sample(img, x, y, 1); id.data[k + 2] = sample(img, x, y, 2); id.data[k + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
    ctx.lineWidth = 2;
    g.questions.forEach((q, i) => {
      const a = res.answers[i], f = res.flags[i];
      if (f) {
        ctx.strokeStyle = '#e0a400';
        ctx.strokeRect((q.bubbles[0].x - left - 4) * ppm, (q.y - top - 3.4) * ppm, (q.bubbles[3].x - q.bubbles[0].x + 8) * ppm, 6.8 * ppm);
      }
      if (a) {
        const b = q.bubbles['ABCD'.indexOf(a)];
        ctx.strokeStyle = f ? '#e0a400' : '#14a05a';
        ctx.beginPath(); ctx.arc((b.x - left) * ppm, (b.y - top) * ppm, (L.BUBBLE_R + 0.9) * ppm, 0, Math.PI * 2); ctx.stroke();
      }
    });
    return cv;
  }

  /* ---------------- full pipeline ---------------- */

  // source: a canvas holding the photo. n: questions expected.
  function analyze(source, n) {
    const W = source.width, Hh = source.height;
    const s = Math.min(1, DETECT_MAX / Math.max(W, Hh));
    const sw = Math.round(W * s), sh = Math.round(Hh * s);
    const small = document.createElement('canvas');
    small.width = sw; small.height = sh;
    small.getContext('2d').drawImage(source, 0, 0, sw, sh);
    const simg = small.getContext('2d').getImageData(0, 0, sw, sh);
    const det = detectMarkers(luminance(simg), sw, sh);
    if (!det.corners) return { ok: false, reason: 'markers' };
    const o = orient(det.corners, det.bin, sw, sh);
    if (!o) return { ok: false, reason: 'orientation', corners: det.corners, scale: s };
    const full = source.getContext('2d').getImageData(0, 0, W, Hh);
    const H = homography(L.MARKS, o.dst.map(([x, y]) => [x / s, y / s]));
    if (!H) return { ok: false, reason: 'markers' };
    const qr = L.parseQr(decodeQr(full, H));
    if (qr && qr.version !== L.VERSION) return { ok: false, reason: 'oldsheet' };
    const count = qr ? qr.n : n;
    const res = readBubbles(full, H, count);
    res.ok = true; res.qr = qr; res.n = count; res.corners = det.corners; res.scale = s;
    res.makePreview = r => preview(full, H, count, r || res);
    return res;
  }

  function quickDetect(source) {
    const W = source.videoWidth || source.width, Hh = source.videoHeight || source.height;
    const s = Math.min(1, DETECT_MAX / Math.max(W, Hh));
    const sw = Math.round(W * s), sh = Math.round(Hh * s);
    const c = quickDetect.canvas || (quickDetect.canvas = document.createElement('canvas'));
    c.width = sw; c.height = sh;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source, 0, 0, sw, sh);
    const det = detectMarkers(luminance(ctx.getImageData(0, 0, sw, sh)), sw, sh);
    return { corners: det.corners, w: sw, h: sh };
  }

  /* ---------------- camera screen ---------------- */

  let jsqrPromise = null;
  function loadJsQR() {
    if (global.jsQR) return Promise.resolve();
    if (!jsqrPromise) jsqrPromise = new Promise(resolve => {
      const sc = document.createElement('script');
      sc.src = JSQR_URL; sc.onload = resolve; sc.onerror = resolve; // scanning still works without it
      document.head.appendChild(sc);
    });
    return jsqrPromise;
  }

  const CSS = `
  .omrscan { position: fixed; inset: 0; z-index: 100; background: #0b0c0e; color: #fff; display: flex; flex-direction: column;
    padding: env(safe-area-inset-top, 0px) 0 env(safe-area-inset-bottom, 0px); font-family: inherit; }
  .omrscan .stage { position: relative; flex: 1; min-height: 0; }
  .omrscan video, .omrscan canvas.ov { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
  .omrscan .hint { margin: 0; padding: .7rem 1rem; text-align: center; font-size: 1rem; line-height: 1.45; background: rgba(0,0,0,.55); min-height: 3.6rem; }
  .omrscan .hint.warn { color: #ffd166; }
  .omrscan .bar { display: flex; gap: .5rem; justify-content: center; flex-wrap: wrap; padding: .6rem 1rem 0; }
  .omrscan .bar:last-child { padding-bottom: 1rem; }
  .omrscan .bar button, .omrscan .bar label { font: inherit; font-weight: 600; min-height: 2.75rem; padding: .5rem 1rem; border-radius: 6px;
    border: 1.5px solid rgba(255,255,255,.5); background: transparent; color: #fff; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
  .omrscan .bar .primary { background: #fff; color: #111; border-color: #fff; }
  .omrscan .bar .torch[aria-pressed="true"] { background: #ffd166; color: #111; border-color: #ffd166; }
  .omrscan input[type=file] { position: absolute; width: 1px; height: 1px; opacity: 0; }
  .omrscan :focus-visible { outline: 3px solid #7aa7ff; outline-offset: 2px; }`;

  const MSG = {
    start: 'ক্যামেরা চালু হচ্ছে…',
    find: 'পুরো OMR পাতাটি ফ্রেমে আনুন। চার কোণের কালো বর্গ যেন দেখা যায়।',
    hold: 'পাতা পাওয়া গেছে। ফোন স্থির রাখুন…',
    reading: 'পড়া হচ্ছে…',
    markers: 'চার কোণের কালো বর্গ খুঁজে পাওয়া যায়নি। পুরো পাতাটি ফ্রেমে আনুন, পাতার ওপর ফোনের ছায়া যেন না পড়ে।',
    orientation: 'পাতাটি চেনা যায়নি। পুরো পাতা ফ্রেমে এনে আবার চেষ্টা করুন।',
    oldsheet: 'এটি পুরনো নকশার OMR শিট। বইয়ের সাথে দেওয়া নতুন শিট ব্যবহার করুন।',
    noLive: 'এই ব্রাউজারে সরাসরি ক্যামেরা চালু হচ্ছে না। নিচের "ক্যামেরা অ্যাপে ছবি তুলুন" চাপুন।',
    denied: 'ক্যামেরা চালু করা যায়নি। ব্রাউজারকে ক্যামেরার অনুমতি দিন, অথবা নিচের "ক্যামেরা অ্যাপে ছবি তুলুন" চাপুন।',
  };

  function canvasFrom(source, w, h, maxSide) {
    const k = Math.min(1, (maxSide || 4000) / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
    return c;
  }

  // opts: { n, examId, onResult(res), onClose() }
  function open(opts) {
    if (!document.getElementById('omrscan-css')) {
      const st = document.createElement('style'); st.id = 'omrscan-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    loadJsQR();
    const el = document.createElement('div');
    el.className = 'omrscan';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'OMR স্ক্যান');
    el.innerHTML = `
      <div class="stage"><video playsinline muted autoplay></video><canvas class="ov"></canvas></div>
      <p class="hint" aria-live="polite"></p>
      <div class="bar">
        <button type="button" class="close">বন্ধ করুন</button>
        <button type="button" class="torch" aria-pressed="false" hidden>টর্চ</button>
        <button type="button" class="shoot primary" hidden>এখনই পড়ুন</button>
      </div>
      <div class="bar">
        <label class="camapp">ক্যামেরা অ্যাপে ছবি তুলুন<input type="file" accept="image/*" capture="environment"></label>
        <label>গ্যালারি থেকে<input type="file" accept="image/*"></label>
      </div>`;
    document.body.appendChild(el);
    document.body.style.overflow = 'hidden';
    const video = el.querySelector('video'), ov = el.querySelector('canvas.ov'), hint = el.querySelector('.hint');
    const shootBtn = el.querySelector('.shoot'), torchBtn = el.querySelector('.torch');
    const say = (t, warn) => { hint.textContent = t; hint.classList.toggle('warn', !!warn); };
    say(MSG.start);
    let stream = null, track = null, imageCapture = null, timer = null, closed = false, busy = false;
    let prev = null, stable = 0, holdUntil = 0;

    function close() {
      if (closed) return; closed = true;
      clearTimeout(timer);
      if (stream) stream.getTracks().forEach(t => t.stop());
      el.remove(); document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') { close(); opts.onClose && opts.onClose(); } }
    document.addEventListener('keydown', onKey);
    el.querySelector('.close').onclick = () => { close(); opts.onClose && opts.onClose(); };
    el.querySelector('.close').focus();

    function drawOverlay(det) {
      const cw = ov.clientWidth, ch = ov.clientHeight;
      ov.width = cw * devicePixelRatio; ov.height = ch * devicePixelRatio;
      const ctx = ov.getContext('2d');
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      if (!det || !det.corners) return;
      const k = Math.min(cw / det.w, ch / det.h), ox = (cw - det.w * k) / 2, oy = (ch - det.h * k) / 2;
      ctx.strokeStyle = '#3ddc84'; ctx.lineWidth = 3; ctx.beginPath();
      det.corners.forEach(([x, y], i) => { const px = ox + x * k, py = oy + y * k; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
      ctx.closePath(); ctx.stroke();
    }

    // Returns an error message, or null if the result was accepted.
    function finish(res) {
      if (!res.ok) return MSG[res.reason] || MSG.markers;
      if (res.qr && res.qr.examId !== String(opts.examId).toUpperCase())
        return `এটি অন্য পরীক্ষার OMR শিট (${res.qr.examId})। সঠিক পরীক্ষার পাতা স্ক্যান করুন।`;
      if (res.n !== opts.n)
        return 'এই OMR শিটের প্রশ্নসংখ্যা পরীক্ষার সাথে মেলেনি। প্রকাশকের সাথে যোগাযোগ করুন।';
      res.preview = res.makePreview ? res.makePreview(res) : null;
      close();
      opts.onResult(res);
      return null;
    }
    function fail(msg) { say(msg, true); holdUntil = Date.now() + 2500; }

    // Best quality: a real photo from the camera sensor (Chrome on Android).
    // Otherwise read three video frames and keep the answers they agree on.
    async function captureAndRead() {
      busy = true; say(MSG.reading);
      await loadJsQR();
      let res = null;
      if (imageCapture) {
        try {
          const blob = await imageCapture.takePhoto();
          const bmp = await createImageBitmap(blob);
          res = analyze(canvasFrom(bmp, bmp.width, bmp.height, 3000), opts.n);
          if (!res.ok) res = null;
        } catch (e) { res = null; }
      }
      if (!res) {
        const reads = [];
        for (let i = 0; i < 3 && !closed; i++) {
          const r = analyze(canvasFrom(video, video.videoWidth, video.videoHeight), opts.n);
          if (r.ok) reads.push(r); else if (!reads.length && i === 2) res = r;
          await new Promise(ok => setTimeout(ok, 120));
        }
        if (reads.length) {
          const v = vote(reads);
          v.makePreview = r => reads[0].makePreview(r);
          res = v;
        }
      }
      busy = false; stable = 0;
      if (closed) return;
      const err = finish(res || { ok: false, reason: 'markers' });
      if (err) fail(err);
    }

    function loop() {
      if (closed) return;
      if (!busy && video.readyState >= 2 && video.videoWidth) {
        const det = quickDetect(video);
        drawOverlay(det);
        if (Date.now() >= holdUntil) {
          if (!det.corners) { stable = 0; say(MSG.find); }
          else {
            const moved = prev ? Math.max(...det.corners.map((p, i) => Math.hypot(p[0] - prev[i][0], p[1] - prev[i][1]))) / det.w : 1;
            stable = moved < 0.02 ? stable + 1 : 0;
            say(MSG.hold);
            if (stable >= 3) { captureAndRead(); }
          }
        }
        prev = det.corners;
      }
      timer = setTimeout(loop, 200);
    }

    shootBtn.onclick = () => { if (!busy && video.videoWidth) captureAndRead(); };

    torchBtn.onclick = async () => {
      const on = torchBtn.getAttribute('aria-pressed') !== 'true';
      try { await track.applyConstraints({ advanced: [{ torch: on }] }); torchBtn.setAttribute('aria-pressed', String(on)); } catch (e) {}
    };

    el.querySelectorAll('input[type=file]').forEach(inp => {
      inp.onchange = e => {
        const f = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!f) return;
        say('ছবি পড়া হচ্ছে…');
        const url = URL.createObjectURL(f);
        const im = new Image();
        im.onload = () => {
          const c = canvasFrom(im, im.naturalWidth, im.naturalHeight, 3000);
          URL.revokeObjectURL(url);
          loadJsQR().then(() => { const err = finish(analyze(c, opts.n)); if (err) say(err, true); });
        };
        im.onerror = () => say('ছবিটি খোলা যায়নি। আবার চেষ্টা করুন।', true);
        im.src = url;
      };
    });

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      say(MSG.noLive, true);
      return { close: close };
    }
    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1440 } },
    }).then(async s => {
      if (closed) { s.getTracks().forEach(t => t.stop()); return; }
      stream = s; track = s.getVideoTracks()[0];
      video.srcObject = s;
      await video.play().catch(() => {});
      const caps = (track.getCapabilities && track.getCapabilities()) || {};
      // keep the picture sharp at close range
      if (caps.focusMode && caps.focusMode.indexOf('continuous') >= 0) track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
      if (caps.torch) torchBtn.hidden = false;
      if (typeof global.ImageCapture === 'function') { try { imageCapture = new global.ImageCapture(track); } catch (e) { imageCapture = null; } }
      shootBtn.hidden = false;
      loop();
    }).catch(() => say(MSG.denied, true));
    return { close: close };
  }

  global.OMRScanner = {
    open: open, analyze: analyze, vote: vote, FLAG_TEXT: FLAG_TEXT, loadJsQR: loadJsQR,
    _internals: { homography: homography, project: project, detectMarkers: detectMarkers, readBubbles: readBubbles },
  };
})(window);
