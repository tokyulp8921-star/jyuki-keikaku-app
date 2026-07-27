// PDF座標定義（重機作業計画書5.pdf, 1190.52 x 841.92 pt, 左上原点でtop値をpdf-lib座標(下原点)に変換して使用）
// pdfplumberで抽出した「入力N」プレースホルダ位置を基準に作成。要目視較正（PDF描画エンジン実装時に調整）。
const PAGE_W = 1190.52;
const PAGE_H = 841.92;

// 機械1/2/3列のX範囲（value領域）
const MACHINE_COLS = [
  { x0: 164.5, x1: 305.9 },
  { x0: 307.1, x1: 448.4 },
  { x0: 449.6, x1: 591.0 },
];

// 各行のY範囲（top=PDF上端からの距離。pdf-lib描画時は PAGE_H - top で下原点に変換）
// bottom は次の行のtopから自動算出（コード側で計算）
const ROWS = {
  taisho: { top: 183.8, label: '対象機械' },        // 12/39/40
  yotei: { top: 210.5, label: '作業予定時間' },      // 13
  meisho: { top: 240.3, label: '機械名称' },         // 14
  noryoku: { top: 260.6, label: '使用能力' },        // 15
  shoyusha: { top: 280.8, label: '所有者' },         // 16
  shiyosha: { top: 301.1, label: '使用者(1次業者名)' }, // 入力1 再掲
  untensha: { top: 321.4, label: '運転者' },         // 17
  basho: { top: 345.8, label: '使用場所' },          // 18
  naiyo: { top: 375.6, label: '作業内容' },          // 19
  hoho: { top: 408.2, label: '作業方法' },           // 20
  taisaku: { top: 441.3, label: '安全対策' },        // 21
  shunin: { top: 467.0, label: '作業主任者(法定)' }, // 22
  shikisha: { top: 487.0, label: '作業指揮者(法定)' }, // 23
  aizusha: { top: 504.8, label: '合図者' },          // 24
  yudosha: { top: 518.7, label: '誘導者/監視員' },   // 25
  aizuhoho: { top: 532.6, label: '合図方法' },       // 26
  kikenhani: { top: 555.9, label: '危険範囲立入禁止措置' }, // 27
  chikei: { top: 588.3, label: '地形' },             // 28
  jiban: { top: 620.6, label: '地盤' },              // 29
  jibanyojo: { top: 642.2, label: '地盤養生' },      // 30
  maisetsu: { top: 653.0, label: '埋設物' },         // 31
  maisetsuHogo: { top: 663.8, label: '防護の方法(埋設物)' }, // 32
  kaku_denryoku: { top: 685.4, label: '架空線近接(電力)' }, // 33
  kaku_denryoku_hogo: { top: 707.0, label: '防護の方法(電力)' }, // 34
  kaku_densha: { top: 728.6, label: '架空線近接(電車)' }, // 35
  kaku_densha_hogo: { top: 750.2, label: '防護の方法(電車)' }, // 36
  tento: { top: 771.8, label: '機械転倒危険場所' },  // 37
  tentoBoshi: { top: 788.0, label: '転倒防止措置' }, // 38
  tableEnd: { top: 810.7, label: '' },
};

const ROW_ORDER = Object.keys(ROWS);
function rowBottom(key) {
  const idx = ROW_ORDER.indexOf(key);
  const nextKey = ROW_ORDER[idx + 1];
  return nextKey ? ROWS[nextKey].top : ROWS.tableEnd.top;
}

// 共通ヘッダー(入力1-11)座標
const HEADER_COORDS = {
  gyoshamei1: { x0: 541.4, x1: 620, top: 66.4, bottom: 79 },       // 入力1(業者名見出し横)
  uchiawase_date: { x0: 433.4, x1: 552, top: 83.8, bottom: 96 },   // 入力2
  uchiawase_time: { x0: 553.3, x1: 597, top: 83.9, bottom: 96 },   // 入力3
  sagyobi: { x0: 433.8, x1: 552, top: 104.8, bottom: 118 },        // 入力4
  chuyabetsu: { x0: 552.5, x1: 597, top: 104.8, bottom: 118 },     // 入力5
  tantosha6: { x0: 219.8, x1: 254, top: 159.3, bottom: 172 },      // 入力6
  tantosha7: { x0: 255.5, x1: 290, top: 159.3, bottom: 172 },      // 入力7
  tantosha8: { x0: 291.1, x1: 330, top: 159.3, bottom: 172 },      // 入力8
  // 1次業者名列 x=342.2〜461.0 / 2次業者名列 x=461.0〜591.7 (PDFから実測した列境界)
  sign9: { x0: 345.0, x1: 458.0, top: 147.0, bottom: 180.0 },      // 入力9 署名(1次業者名列)
  gyoshamei10: { x0: 464.0, x1: 589.0, top: 134.0, bottom: 146.5 },// 入力10
  sign11: { x0: 464.0, x1: 589.0, top: 147.0, bottom: 180.0 },     // 入力11 署名(2次業者名列)
  gyoshamei1_col1: { x0: 345.0, x1: 458.0, top: 134.0, bottom: 146.5 }, // 1次業者名欄(入力1再掲)
};

// 画像挿入枠（赤枠）
const IMAGE_FRAME = { x0: 597.8, x1: 1128.5, top: 94.6, bottom: 439.2 };

// 機械カラムのラベルオフセット(参考: col2 = col1 + 142.6, col3 = col1 + 285.1)
window.PDF_COORDS = { PAGE_W, PAGE_H, MACHINE_COLS, ROWS, ROW_ORDER, rowBottom, HEADER_COORDS, IMAGE_FRAME };
