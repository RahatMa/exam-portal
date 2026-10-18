/* =========================================================
   goal.physics: money receipt (A5) and helpers.
   Used by admin.html and student.html. Needs qrcode-generator.
   ========================================================= */
(function (g) {
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
g.monthName = function (ym) { if (!/^\d{4}-\d{2}$/.test(ym || '')) return ym || ''; const [y, m] = ym.split('-'); return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m - 1] + ' ' + y; };
g.qrSvgText = function (text, pad = 1) {
  if (typeof qrcode !== 'function') return '';
  const q = qrcode(0, 'M'); q.addData(text); q.make(); const m = q.getModuleCount(); let d = '';
  for (let r = 0; r < m; r++) for (let c = 0; c < m; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return `<svg viewBox="-${pad} -${pad} ${m + 2 * pad} ${m + 2 * pad}" xmlns="http://www.w3.org/2000/svg"><rect x="-${pad}" y="-${pad}" width="${m + 2 * pad}" height="${m + 2 * pad}" fill="#fff"/><path d="${d}" fill="#0B1F4B"/></svg>`;
}
// Taka amount in English words, Bangladeshi style (lakh, crore).
g.takaWords = function takaWords(n) {
  n = Math.round(Number(n) || 0);
  if (!n) return 'Zero';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const t = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = x => x < 20 ? a[x] : t[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : '');
  const three = x => (x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' : '') : '') + (x % 100 ? two(x % 100) : '');
  const parts = [];
  const crore = Math.floor(n / 1e7); n %= 1e7; const lakh = Math.floor(n / 1e5); n %= 1e5; const th = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(takaWords(crore) + ' Crore'); if (lakh) parts.push(two(lakh) + ' Lakh'); if (th) parts.push(two(th) + ' Thousand'); if (n) parts.push(three(n));
  return parts.join(' ');
}

g.receiptHtml = function (r, siteName, logo) {
  const tk = n => '৳ ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const d = new Date(r.at);
  const when = isNaN(d) ? r.date : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const s = r.student || {};
  return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${esc(r.no)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
  @page { size: A5; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #eceef1; font: 10pt/1.45 'Hind Siliguri', system-ui, sans-serif; color: #0B1F4B; }
  .bar { padding: 10px; font: 14px system-ui; text-align: center; }
  .page { width: 148mm; min-height: 210mm; margin: 0 auto 10mm; background: #fff; padding: 10mm 10mm 8mm; position: relative; display: flex; flex-direction: column; }
  .head { display: grid; grid-template-columns: 1fr auto; gap: 4mm; align-items: center; border-bottom: .6mm solid #0B1F4B; padding-bottom: 3mm; }
  .head img { height: 15mm; }
  .head .c { text-align: right; font-size: 8.5pt; color: #3a4a6b; }
  .title { display: flex; justify-content: space-between; align-items: baseline; margin: 4mm 0 3mm; }
  .title h1 { margin: 0; font-size: 14pt; letter-spacing: .12em; color: #1F6FEB; }
  .title .no { font: 700 11pt ui-monospace, monospace; }
  .info { display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 1mm 3mm; font-size: 9.5pt; background: #f2f6fd; border-radius: 2mm; padding: 2.5mm 3mm; }
  .info dt { color: #5a6888; } .info dd { margin: 0; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-top: 4mm; font-size: 9.5pt; }
  th { text-align: left; font-size: 8pt; text-transform: uppercase; letter-spacing: .06em; color: #5a6888; border-bottom: .3mm solid #0B1F4B; padding: 1.5mm 1mm; }
  td { padding: 1.8mm 1mm; border-bottom: .2mm solid #d6deec; vertical-align: top; }
  td.a, th.a { text-align: right; white-space: nowrap; }
  .sum td { border: 0; padding: 1mm; } .sum .tot td { font-size: 12pt; font-weight: 700; border-top: .5mm solid #0B1F4B; padding-top: 2mm; }
  .words { margin-top: 2mm; font-size: 9pt; } .words b { font-weight: 600; }
  .foot { margin-top: auto; display: grid; grid-template-columns: auto 1fr auto; gap: 4mm; align-items: end; padding-top: 6mm; }
  .foot svg { width: 18mm; height: 18mm; }
  .sig { text-align: center; font-size: 8.5pt; } .sig .line { border-top: .3mm solid #0B1F4B; width: 40mm; margin: 10mm auto 1mm; }
  .note { font-size: 7.5pt; color: #5a6888; margin-top: 3mm; text-align: center; }
  .void { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; }
  .void span { transform: rotate(-30deg); font: 700 40pt system-ui; color: rgba(196,50,27,.22); border: 2mm solid rgba(196,50,27,.22); padding: 2mm 8mm; }
  @media print { body { background: #fff; } .bar { display: none; } .page { margin: 0; } }
  </style></head><body>
  <div class="bar">Money receipt ${esc(r.no)} · <button onclick="print()">Print (A5)</button></div>
  <div class="page">
    ${r.status === 'CANCELLED' ? '<div class="void"><span>CANCELLED</span></div>' : ''}
    <div class="head"><img src="${esc(logo)}" alt="${esc(siteName)}"><div class="c"><b style="font-size:10pt;color:#0B1F4B">${esc(siteName)}</b>${r.centre && r.centre.address ? '<br>' + esc(r.centre.address) : ''}${r.centre && r.centre.phone ? '<br>' + esc(r.centre.phone) : ''}</div></div>
    <div class="title"><h1>MONEY RECEIPT</h1><span class="no">No. ${esc(r.no)}</span></div>
    <dl class="info">
      <dt>Student</dt><dd>${esc(s.name || r.studentName)}</dd><dt>ID</dt><dd>${esc(r.studentId)}</dd>
      <dt>Mobile</dt><dd>${esc(s.phone || '')}</dd><dt>Date</dt><dd>${esc(when)}</dd>
      ${s.guardianName || s.guardianPhone ? `<dt>Guardian</dt><dd style="grid-column:2/-1">${esc(s.guardianName || '')} ${esc(s.guardianPhone || '')}</dd>` : ''}
    </dl>
    <table><thead><tr><th>#</th><th>Description</th><th class="a">Amount</th></tr></thead><tbody>
      ${r.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.label.replace(/Monthly fee (\d{4}-\d{2})/, (m, ym) => 'Monthly fee, ' + monthName(ym)))}${l.discount ? `<br><span style="color:#5a6888;font-size:8.5pt">Discount ${tk(l.discount)}</span>` : ''}</td><td class="a">${tk(l.gross)}</td></tr>`).join('')}
    </tbody></table>
    <table class="sum"><tbody>
      ${r.discount ? `<tr><td>Subtotal</td><td class="a">${tk(r.subtotal)}</td></tr><tr><td>Discount${r.coupon ? ' (coupon ' + esc(r.coupon) + ')' : ''}</td><td class="a">− ${tk(r.discount)}</td></tr>` : ''}
      <tr class="tot"><td>Total received (${esc(r.method || 'Cash')})</td><td class="a">${tk(r.total)}</td></tr>
    </tbody></table>
    <div class="words">In words: <b>Taka ${esc(takaWords(r.total))} Only</b></div>
    ${r.note ? `<div class="words">Note: ${esc(r.note)}</div>` : ''}
    ${r.status === 'CANCELLED' ? `<div class="words" style="color:#c4321b">Cancelled: ${esc(r.cancelReason)}</div>` : ''}
    <div class="foot">
      <div>${qrSvgText('RECEIPT:' + r.no + ':' + r.studentId + ':' + r.total)}</div>
      <div style="font-size:8.5pt">Received by<br><b>${esc(r.receivedByName || r.receivedBy)}</b></div>
      <div class="sig"><div class="line"></div>Authorised signature</div>
    </div>
    <div class="note">Computer-generated receipt. Please keep it for your records.</div>
  </div>
  </body></html>`;
}


})(window);
