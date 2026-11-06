/* =========================================================
   WORD (.docx) QUESTION READER — runs in the browser.
   Needs JSZip. Used by admin.html ("Upload Word file").

   Understands documents written like:
     ১. প্রশ্নের লেখা …
     (ক) … (খ) … (গ) … (ঘ) …         (one per line, several per line, or in a table)
     সঠিক উত্তর: (খ)
     সমাধান / ব্যাখ্যা:
     … solution lines …
   Word equations become \( … \) / \[ … \]; pictures become [img:@N].
   ========================================================= */
(function (global) {
  'use strict';
  const NS = {
    w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    m: 'http://schemas.openxmlformats.org/officeDocument/2006/math',
    r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  };
  const BN = '০১২৩৪৫৬৭৮৯';
  const enDigits = s => String(s).replace(/[০-৯]/g, d => BN.indexOf(d));
  const LETTER = { 'ক': 'A', 'খ': 'B', 'গ': 'C', 'ঘ': 'D', a: 'A', b: 'B', c: 'C', d: 'D', A: 'A', B: 'B', C: 'C', D: 'D' };

  const kids = el => Array.from(el ? el.childNodes : []).filter(n => n.nodeType === 1);
  const child = (el, ns, name) => kids(el).find(n => n.localName === name && n.namespaceURI === NS[ns]) || null;
  const attr = (el, ns, name) => el ? (el.getAttributeNS(NS[ns], name) || el.getAttribute(ns + ':' + name)) : null;
  const isW = (n, name) => n.namespaceURI === NS.w && n.localName === name;
  const isM = (n, name) => n.namespaceURI === NS.m && (!name || n.localName === name);

  /* ---------------- Word equations (OMML) → LaTeX ---------------- */
  const SYM = {
    '×': '\\times ', '÷': '\\div ', '−': '-', '·': '\\cdot ', '⋅': '\\cdot ', '±': '\\pm ', '∓': '\\mp ', '≤': '\\le ', '≥': '\\ge ', '≠': '\\ne ',
    '≈': '\\approx ', '∝': '\\propto ', '∞': '\\infty ', '→': '\\rightarrow ', '←': '\\leftarrow ', '⇒': '\\Rightarrow ', '⟹': '\\Longrightarrow ',
    '⇔': '\\Leftrightarrow ', '∴': '\\therefore ', '∵': '\\because ', '°': '^{\\circ}', '′': "'", '∠': '\\angle ', '∆': '\\Delta ', '√': '\\surd ',
    '∫': '\\int ', '∑': '\\sum ', '∏': '\\prod ', '∂': '\\partial ', '∇': '\\nabla ', '∈': '\\in ', '⊥': '\\perp ', '∥': '\\parallel ', '…': '\\ldots ',
    'α': '\\alpha ', 'β': '\\beta ', 'γ': '\\gamma ', 'δ': '\\delta ', 'ε': '\\varepsilon ', 'θ': '\\theta ', 'λ': '\\lambda ', 'μ': '\\mu ', 'ν': '\\nu ',
    'π': '\\pi ', 'ρ': '\\rho ', 'σ': '\\sigma ', 'τ': '\\tau ', 'φ': '\\phi ', 'ω': '\\omega ', 'η': '\\eta ', 'Ω': '\\Omega ', 'Δ': '\\Delta ',
    'Σ': '\\Sigma ', 'Φ': '\\Phi ', 'Λ': '\\Lambda ', 'Γ': '\\Gamma ', 'Θ': '\\Theta ', 'Π': '\\Pi ', 'ψ': '\\psi ', 'χ': '\\chi ', 'κ': '\\kappa ', 'ζ': '\\zeta ', 'ξ': '\\xi ',
  };
  const FUNCS = ['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'log', 'ln', 'exp', 'lim', 'max', 'min', 'sinh', 'cosh', 'tanh', 'det'];
  const ACCENT = { '\u0307': '\\dot', '\u0308': '\\ddot', '\u0302': '\\hat', '\u0303': '\\tilde', '\u20d7': '\\vec', '\u0304': '\\bar', '\u2192': '\\vec', '\u0305': '\\overline' };

  function texChars(s, plain) {
    let out = '', bengali = '';
    const flush = () => { if (bengali) { out += '\\text{' + bengali + '}'; bengali = ''; } };
    for (const ch of s) {
      if (/[\u0980-\u09FF]/.test(ch)) { bengali += ch; continue; }
      flush();
      if (SYM[ch]) out += SYM[ch];
      else if ('{}#%&$_'.includes(ch)) out += '\\' + ch;
      else if (ch === '\\') out += '\\backslash ';
      else if (ch === ' ') out += '\\ ';   // keep the spaces typed in Word (e.g. "10 N")
      else out += ch;
    }
    flush();
    return out;
  }
  const grp = s => '{' + s + '}';
  const arg = (el, name) => omml(child(el, 'm', name));
  const prop = (el, prName, name) => { const p = child(el, 'm', prName); const c = p && child(p, 'm', name); return c ? attr(c, 'm', 'val') : null; };

  function omml(el) {
    if (!el) return '';
    let out = '';
    for (const n of kids(el)) {
      if (!isM(n)) {
        if (isW(n, 'r')) out += texChars(kids(n).filter(k => isW(k, 't')).map(k => k.textContent).join(''), false);
        continue;
      }
      switch (n.localName) {
        case 'r': {
          const text = kids(n).filter(k => isM(k, 't') || isW(k, 't')).map(k => k.textContent).join('');
          const rpr = child(n, 'm', 'rPr');
          const plain = rpr && kids(rpr).some(k => isM(k, 'sty') && attr(k, 'm', 'val') === 'p') || (rpr && child(rpr, 'm', 'nor'));
          const fn = FUNCS.includes(text.trim()) ? '\\' + text.trim() + ' ' : null;
          if (fn) out += fn;
          else if (plain && /[A-Za-z]/.test(text) && text.trim()) out += '\\mathrm{' + texChars(text, true) + '}';
          else out += texChars(text, plain);
          break;
        }
        case 'f': {
          const type = prop(n, 'fPr', 'type');
          out += type === 'lin' ? grp(arg(n, 'num')) + '/' + grp(arg(n, 'den')) : '\\frac' + grp(arg(n, 'num')) + grp(arg(n, 'den'));
          break;
        }
        case 'sSup': out += grp(arg(n, 'e')) + '^' + grp(arg(n, 'sup')); break;
        case 'sSub': out += grp(arg(n, 'e')) + '_' + grp(arg(n, 'sub')); break;
        case 'sSubSup': out += grp(arg(n, 'e')) + '_' + grp(arg(n, 'sub')) + '^' + grp(arg(n, 'sup')); break;
        case 'sPre': out += '{}_' + grp(arg(n, 'sub')) + '^' + grp(arg(n, 'sup')) + grp(arg(n, 'e')); break;
        case 'rad': {
          const deg = arg(n, 'deg').trim();
          out += '\\sqrt' + (deg ? '[' + deg + ']' : '') + grp(arg(n, 'e'));
          break;
        }
        case 'd': {
          const pr = child(n, 'm', 'dPr');
          const get = nm => { const c = pr && child(pr, 'm', nm); return c ? attr(c, 'm', 'val') : null; };
          let beg = get('begChr'), end = get('endChr'), sep = get('sepChr');
          beg = beg === null ? '(' : beg; end = end === null ? ')' : end; sep = sep === null ? '|' : sep;
          const D = c => c === '' ? '.' : c === '{' ? '\\{' : c === '}' ? '\\}' : c === '|' ? '|' : c === '‖' ? '\\|' : c === '⟨' ? '\\langle' : c === '⟩' ? '\\rangle' : c === '⌊' ? '\\lfloor' : c === '⌋' ? '\\rfloor' : c;
          const parts = kids(n).filter(k => isM(k, 'e')).map(omml);
          out += '\\left' + D(beg) + parts.join(sep === '|' ? '\\mid ' : texChars(sep)) + '\\right' + D(end);
          break;
        }
        case 'nary': {
          const pr = child(n, 'm', 'naryPr');
          const c = pr && child(pr, 'm', 'chr');
          const ch = c ? attr(c, 'm', 'val') : '∫';
          const op = { '∑': '\\sum', '∏': '\\prod', '∫': '\\int', '∬': '\\iint', '∭': '\\iiint', '∮': '\\oint', '⋃': '\\bigcup', '⋂': '\\bigcap' }[ch] || texChars(ch);
          const sub = arg(n, 'sub'), sup = arg(n, 'sup');
          out += op + (sub ? '_' + grp(sub) : '') + (sup ? '^' + grp(sup) : '') + ' ' + arg(n, 'e');
          break;
        }
        case 'func': {
          const name = omml(child(n, 'm', 'fName')).trim();
          const plainName = name.replace(/^\\mathrm\{(.*)\}$/, '$1');
          out += (FUNCS.includes(plainName) ? '\\' + plainName + ' ' : /\\[a-zA-Z]/.test(name) ? name + ' ' : '\\operatorname{' + plainName + '}') + arg(n, 'e');
          break;
        }
        case 'acc': {
          const c = prop(n, 'accPr', 'chr');
          out += (ACCENT[c === null ? '\u0302' : c] || '\\hat') + grp(arg(n, 'e'));
          break;
        }
        case 'bar': out += (prop(n, 'barPr', 'pos') === 'bot' ? '\\underline' : '\\overline') + grp(arg(n, 'e')); break;
        case 'limLow': out += grp(arg(n, 'e')) + '_' + grp(arg(n, 'lim')); break;
        case 'limUpp': out += grp(arg(n, 'e')) + '^' + grp(arg(n, 'lim')); break;
        case 'groupChr': {
          const c = prop(n, 'groupChrPr', 'chr'), pos = prop(n, 'groupChrPr', 'pos');
          out += (c === '⏟' || pos === 'bot' ? '\\underbrace' : '\\overbrace') + grp(arg(n, 'e'));
          break;
        }
        case 'eqArr': out += '\\begin{aligned}' + kids(n).filter(k => isM(k, 'e')).map(e => omml(e).replace(/&/g, '&')).join('\\\\') + '\\end{aligned}'; break;
        case 'm': {
          const rows = kids(n).filter(k => isM(k, 'mr')).map(mr => kids(mr).filter(k => isM(k, 'e')).map(omml).join(' & '));
          out += '\\begin{matrix}' + rows.join('\\\\') + '\\end{matrix}';
          break;
        }
        case 'oMath': out += omml(n); break;
        case 'box': case 'borderBox': case 'phant': case 'e': case 'num': case 'den': case 'sub': case 'sup': case 'deg': case 'lim': case 'fName':
          out += omml(n); break;
        default:
          if (!/Pr$/.test(n.localName)) out += omml(n);
      }
    }
    return out;
  }
  const tidy = s => s.replace(/\s+/g, ' ').replace(/\\ \s*$/g, '').trim();

  /* ---------------- document → lines ---------------- */
  async function parse(buffer) {
    if (typeof global.JSZip !== 'function') throw new Error('JSZIP_MISSING');
    let zip;
    try { zip = await global.JSZip.loadAsync(buffer); } catch (e) { throw new Error('NOT_DOCX'); }
    const docFile = zip.file('word/document.xml');
    if (!docFile) throw new Error('NOT_DOCX');
    const xml = s => new DOMParser().parseFromString(s, 'application/xml');
    const doc = xml(await docFile.async('string'));

    // relationships (pictures)
    const rels = {};
    const relFile = zip.file('word/_rels/document.xml.rels');
    if (relFile) Array.from(xml(await relFile.async('string')).getElementsByTagName('Relationship'))
      .forEach(r => { rels[r.getAttribute('Id')] = r.getAttribute('Target'); });

    // automatic numbering (Word list numbers aren't in the text)
    const numbering = {};
    const numFile = zip.file('word/numbering.xml');
    if (numFile) {
      const nd = xml(await numFile.async('string'));
      const abs = {};
      Array.from(nd.getElementsByTagNameNS(NS.w, 'abstractNum')).forEach(a => {
        const levels = {};
        Array.from(a.getElementsByTagNameNS(NS.w, 'lvl')).forEach(l => {
          const fmt = l.getElementsByTagNameNS(NS.w, 'numFmt')[0], txt = l.getElementsByTagNameNS(NS.w, 'lvlText')[0];
          levels[attr(l, 'w', 'ilvl')] = { fmt: fmt ? attr(fmt, 'w', 'val') : '', text: txt ? attr(txt, 'w', 'val') : '' };
        });
        abs[attr(a, 'w', 'abstractNumId')] = levels;
      });
      Array.from(nd.getElementsByTagNameNS(NS.w, 'num')).forEach(n => {
        const a = n.getElementsByTagNameNS(NS.w, 'abstractNumId')[0];
        if (a) numbering[attr(n, 'w', 'numId')] = abs[attr(a, 'w', 'val')] || {};
      });
    }

    const images = [];   // { target, ext, blob, supported }
    const imageIndex = {};
    async function addImage(rid) {
      const target = rels[rid];
      if (!target) return null;
      if (imageIndex[target] !== undefined) return imageIndex[target];
      const path = target.startsWith('/') ? target.slice(1) : 'word/' + target.replace(/^\.\//, '');
      const f = zip.file(path);
      const ext = (target.split('.').pop() || '').toLowerCase();
      const blob = f ? await f.async('blob') : null;
      images.push({ target, ext, blob, supported: !!blob && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext) });
      imageIndex[target] = images.length - 1;
      return images.length - 1;
    }

    // one paragraph → { text, list: 'q' | 'o' | null }
    async function para(p) {
      let text = '';
      const walk = async el => {
        for (const n of kids(el)) {
          if (isW(n, 'r')) {
            for (const k of kids(n)) {
              if (isW(k, 't')) text += k.textContent;
              else if (isW(k, 'tab')) text += ' ';
              else if (isW(k, 'br') || isW(k, 'cr')) text += '\n';
              else if (isW(k, 'drawing') || isW(k, 'pict') || isW(k, 'object')) {
                const blips = Array.from(k.getElementsByTagName('*')).filter(x => x.localName === 'blip' || x.localName === 'imagedata');
                for (const b of blips) {
                  const rid = b.getAttributeNS(NS.r, 'embed') || b.getAttributeNS(NS.r, 'id') || b.getAttribute('r:embed') || b.getAttribute('r:id');
                  const idx = await addImage(rid);
                  if (idx !== null) text += '\n[img:@' + idx + ']\n';
                }
              }
            }
          } else if (isM(n, 'oMathPara')) {
            kids(n).filter(k => isM(k, 'oMath')).forEach(om => { text += '\n\\[' + tidy(omml(om)) + '\\]\n'; });
          } else if (isM(n, 'oMath')) {
            text += '\\(' + tidy(omml(n)) + '\\)';
          } else if (isW(n, 'hyperlink') || isW(n, 'ins') || isW(n, 'smartTag') || isW(n, 'fldSimple') || isW(n, 'customXml') || isW(n, 'sdt') || isW(n, 'sdtContent')) {
            await walk(n);
          }
        }
      };
      await walk(p);
      let list = null;
      const ppr = child(p, 'w', 'pPr'), np = ppr && child(ppr, 'w', 'numPr');
      if (np) {
        const ilvl = attr(child(np, 'w', 'ilvl'), 'w', 'val') || '0', numId = attr(child(np, 'w', 'numId'), 'w', 'val');
        const lv = (numbering[numId] || {})[ilvl] || {};
        if (numId && numId !== '0') {
          if (/letter|Letter|hindiVowels|bengali.*Letter/.test(lv.fmt || '') || /^\(/.test(lv.text || '')) list = 'o';
          else if (lv.fmt === 'bullet') list = null;
          else list = ilvl === '0' ? 'q' : 'o';
        }
      }
      return { text, list };
    }

    const lines = [];
    async function block(el) {
      for (const n of kids(el)) {
        if (isW(n, 'p')) {
          const p = await para(n);
          p.text.split('\n').forEach((t, i) => lines.push({ text: t, list: i === 0 ? p.list : null }));
        } else if (isW(n, 'tbl')) {
          for (const tr of kids(n).filter(k => isW(k, 'tr'))) for (const tc of kids(tr).filter(k => isW(k, 'tc'))) await block(tc);
        } else if (isW(n, 'sdt')) {
          const c = child(n, 'w', 'sdtContent'); if (c) await block(c);
        }
      }
    }
    const body = doc.getElementsByTagNameNS(NS.w, 'body')[0];
    await block(body);
    const clean = lines.map(l => ({ text: l.text.replace(/\u00a0/g, ' ').trim(), list: l.list })).filter(l => l.text || l.list);
    return Object.assign(findQuestions(clean), { images, lines: clean });
  }

  /* ---------------- lines → questions ---------------- */
  const RE_Q = /^(?:প্রশ্ন\s*(?:নং|নম্বর)?\s*)?([০-৯0-9]{1,3})\s*[.।:)]\s*/;
  const RE_OPT_START = /^(?:\(\s*([কখগঘa-dA-D])\s*\)|([কখগঘ])\s*[).।]|([a-dA-D])\s*\))\s*/;
  const RE_OPT_ANY = /\(\s*([কখগঘ])\s*\)|\(\s*([a-dA-D])\s*\)/g;
  const RE_ANS = /^(?:সঠিক\s*)?(?:উত্তর|উঃ|Ans(?:wer)?|Correct\s*answer)\s*[:：ঃ.\-]?\s*\(?\s*([কখগঘa-dA-D])\s*\)?(?![\u0980-\u09FFa-zA-Z])/i;
  const RE_SOL = /^(সমাধান(?:\s*[\/ও]\s*ব্যাখ্যা)?|ব্যাখ্যা|Solution|Explanation)\s*(?:[:：ঃ]|$)\s*/i;

  function splitOptions(text) {
    // "(ক) 2N (খ) 4N (গ) …" → ['2N', '4N', …] with letters
    const hits = [];
    let m;
    RE_OPT_ANY.lastIndex = 0;
    while ((m = RE_OPT_ANY.exec(text))) hits.push({ at: m.index, end: m.index + m[0].length, key: LETTER[m[1] || m[2]] });
    if (hits.length < 2 || hits[0].at !== 0) return null;
    return hits.map((h, i) => ({ key: h.key, text: text.slice(h.end, i + 1 < hits.length ? hits[i + 1].at : undefined).trim() }));
  }

  // Section headings switch the question type for the questions that follow.
  // A heading line on its own, e.g. "সৃজনশীল প্রশ্ন", "খ অংশ: সংক্ষিপ্ত প্রশ্ন (২০ নম্বর)", "Math problems:".
  const SECTION_WORDS = [
    ['CQ', 'সৃজনশীল|Creative|CQ'], ['SQ', 'সংক্ষিপ্ত|Short(?:\\s*answer)?|SQ'],
    ['MATH', 'গাণিতিক|গানিতিক|Mathematical|Math'], ['MCQ', 'বহুনির্বাচনী|Multiple\\s*choice|MCQ'],
  ].map(([type, words]) => [new RegExp('^(?:[কখগঘ]\\s*(?:অংশ|বিভাগ)\\s*[:：ঃ.\\-–]?\\s*|(?:Part|Section)\\s*[A-D1-4]\\s*[:.\\-–]?\\s*|\\d+\\s*[.)]\\s*)?(?:' + words + ')\\s*(?:প্রশ্ন(?:াবলি|সমূহ)?|সমস্যা(?:বলি|সমূহ)?|অংশ|questions?|problems?|part|section)?$', 'i'), type]);
  const RE_SECTION = SECTION_WORDS;
  const RE_PART = /^\(?\s*([কখগঘঙচ])\s*[.)।]\s*/;          // CQ parts: ক.  (খ)  গ)
  const RE_MARKS = /\s*[\[(]\s*([০-৯0-9]+(?:\.[০-৯0-9]+)?)\s*[\])]\s*$/;  // trailing [৩] or (5)
  const RE_WANS = /^(উত্তর|সমাধান(?:\s*[\/ও]\s*ব্যাখ্যা)?|ব্যাখ্যা|Answer|Solution)\s*[:：ঃ]\s*/i;
  const PART_KEYS = 'কখগঘঙচ';
  const CQ_DEFAULT = [1, 2, 3, 4, 4, 4];

  function sectionOf(t) {
    if (t.length > 60 || RE_OPT_START.test(t)) return null;
    const core = t.replace(/\s*(?:\([^)]*\)|\[[^\]]*\])\s*$/, '').replace(/[\s:：ঃ.\-–]+$/, '').trim();
    for (const [re, type] of RE_SECTION) if (re.test(core)) return type;
    return null;
  }
  function takeMarks(text) {
    const m = RE_MARKS.exec(text);
    return m ? { text: text.slice(0, m.index).trim(), marks: Number(enDigits(m[1])) } : { text: text, marks: null };
  }

  function findQuestions(lines) {
    const qs = [];
    let cur = null, part = 'pre', mode = 'MCQ', freshSection = false;
    const start = no => {
      cur = { no, type: mode, qLines: [], options: { A: '', B: '', C: '', D: '' }, optCount: 0, answer: '', sLines: [], parts: [], marks: null, lastOpt: null };
      qs.push(cur); part = 'q'; freshSection = false;
    };
    const ready = () => cur && (cur.type === 'MCQ' ? cur.answer && cur.optCount >= 4 : cur.type === 'CQ' ? cur.parts.length > 0 : cur.qLines.length > 0);
    for (const ln of lines) {
      let t = ln.text;
      const sec = sectionOf(t);
      if (sec) { mode = sec; freshSection = true; part = 'pre'; continue; }
      const qm = RE_Q.exec(t);
      const optStart = RE_OPT_START.exec(t);
      const partStart = mode === 'CQ' ? RE_PART.exec(t) : null;
      if (qm && !optStart && !partStart) {
        const no = parseInt(enDigits(qm[1]), 10);
        if (!cur || freshSection || cur.type !== mode || no === cur.no + 1 || (ready() && no > cur.no) || part === 'pre') {
          start(no); t = t.slice(qm[0].length);
          if (t) { if (mode === 'SQ' || mode === 'MATH') { const mk = takeMarks(t); t = mk.text; if (mk.marks !== null) cur.marks = mk.marks; } cur.qLines.push(t); }
          continue;
        }
      } else if (ln.list === 'q' && (!cur || part !== 'q' || cur.optCount || cur.parts.length)) {
        start(cur ? cur.no + 1 : 1); if (t) cur.qLines.push(t); continue;
      }
      if (!cur) continue; // text before the first question (title, instructions)

      if (cur.type === 'CQ') {
        if (partStart) {
          const mk = takeMarks(t.slice(partStart[0].length).trim());
          const idx = PART_KEYS.indexOf(partStart[1]);
          cur.parts.push({ text: mk.text, marks: mk.marks !== null ? mk.marks : CQ_DEFAULT[idx] || 1, solution: '' });
          part = 'p'; continue;
        }
        const wa = RE_WANS.exec(t);
        if (wa) { part = cur.parts.length ? 'ps' : 's'; t = t.slice(wa[0].length).trim(); }
        if (part === 'ps') { const pp = cur.parts[cur.parts.length - 1]; if (t) pp.solution += (pp.solution ? '\n' : '') + t; continue; }
        if (part === 's') { if (t) cur.sLines.push(t); continue; }
        if (part === 'p') { const pp = cur.parts[cur.parts.length - 1]; const mk = takeMarks(t); if (mk.marks !== null) pp.marks = mk.marks; pp.text += '\n' + mk.text; continue; }
        cur.qLines.push(t); continue;
      }
      if (cur.type === 'SQ' || cur.type === 'MATH') {
        const wa = RE_WANS.exec(t);
        if (wa) { part = 's'; t = t.slice(wa[0].length).trim(); if (t) cur.sLines.push(t); continue; }
        if (part === 's') { cur.sLines.push(t); continue; }
        const mk = takeMarks(t); if (mk.marks !== null) cur.marks = mk.marks;
        cur.qLines.push(mk.text); continue;
      }

      // MCQ
      const am = RE_ANS.exec(t);
      if (am && part !== 's') { cur.answer = LETTER[am[1]] || ''; part = 'a'; const rest = t.slice(am[0].length).trim(); if (rest) { const sm = RE_SOL.exec(rest); if (sm) { part = 's'; if (rest.slice(sm[0].length)) cur.sLines.push(rest.slice(sm[0].length)); } } continue; }
      const sm = RE_SOL.exec(t);
      if (sm && part !== 's') { part = 's'; t = t.slice(sm[0].length).trim(); if (t) cur.sLines.push(t); continue; }
      if (part === 's') { cur.sLines.push(t); continue; }
      const many = splitOptions(t);
      if (many) { many.forEach(o => { if (!cur.options[o.key]) cur.optCount++; cur.options[o.key] = o.text; }); part = 'o'; continue; }
      if (optStart) {
        const key = LETTER[optStart[1] || optStart[2] || optStart[3]];
        if (!cur.options[key]) cur.optCount++;
        cur.options[key] = t.slice(optStart[0].length).trim();
        part = 'o'; cur.lastOpt = key; continue;
      }
      if (ln.list === 'o') {
        const key = 'ABCD'[Math.min(3, cur.optCount)];
        if (!cur.options[key]) cur.optCount++;
        cur.options[key] = t; part = 'o'; cur.lastOpt = key; continue;
      }
      if (part === 'o' && cur.lastOpt) { cur.options[cur.lastOpt] += (cur.options[cur.lastOpt] ? '\n' : '') + t; continue; }
      if (part === 'q') cur.qLines.push(t);
      else cur.sLines.push(t); // stray text after the answer: treat as solution
    }

    return qs.map(q => ({
      no: q.no, type: q.type, question: q.qLines.join('\n').trim(), options: ['A', 'B', 'C', 'D'].map(k => q.options[k].trim()),
      answer: q.type === 'MCQ' ? q.answer : '', solution: q.sLines.join('\n').trim(),
      parts: q.parts.map(p => ({ text: p.text.trim(), marks: p.marks, solution: p.solution.trim() })),
      marks: q.type === 'SQ' || q.type === 'MATH' ? q.marks : null, problems: [],
    }));
  }

  global.DocxImport = { parse: parse, findQuestions: findQuestions, omml: omml };
})(window);
