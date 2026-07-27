// 日本の祝日データ(data/holidays.json)を使い、入力4「作業日」= 入力2の翌日(土日祝なら次の平日)を計算する。
const Holidays = (() => {
  let table = null; // { 'YYYY-MM-DD': '名称' }

  async function load() {
    if (table) return table;
    const res = await fetch(`data/holidays.json?v=${Date.now()}`, { cache: 'no-store' });
    table = await res.json();
    return table;
  }

  function fmt(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function isHoliday(d) { return !!(table && table[fmt(d)]); }
  function isWeekend(d) { const w = d.getDay(); return w === 0 || w === 6; }

  // 翌日から開始し、土日祝日でなくなるまで1日ずつ進める
  function nextBusinessDayAfter(dateStr) {
    if (!dateStr) return '';
    const base = new Date(dateStr + 'T00:00:00');
    let d = new Date(base);
    d.setDate(d.getDate() + 1);
    let guard = 0;
    while ((isWeekend(d) || isHoliday(d)) && guard < 30) {
      d.setDate(d.getDate() + 1);
      guard++;
    }
    return fmt(d);
  }

  function toYYMMDD(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return y.slice(2) + m + d;
  }

  return { load, nextBusinessDayAfter, toYYMMDD, fmt };
})();
