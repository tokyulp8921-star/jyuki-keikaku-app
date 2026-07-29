// クレーン計画書PDF座標定義(クレーン計画書.pdf, 1190.52 x 841.92 pt, 左上原点でtopをpdf-lib座標(下原点)に変換して使用)
// fitzで抽出した「入力N」プレースホルダ位置を基準に作成。要目視較正。
const CranePdfCoords = (() => {
  const PAGE_W = 1190.52;
  const PAGE_H = 841.92;

  // ヘッダー(101-106): 単一値
  const HEADER = {
    uchiawaseDate: { x: 436.6, top: 81.3, width: 137, height: 12 },
    sagyobi: { x: 436.6, top: 94.2, width: 137, height: 12 },
    gyoshamei: { x: 513, top: 132.3, width: 80, height: 12 },
    gyoshamei_dup: { x: 396.6, top: 742.0, width: 80, height: 12 }, // 協力会社確認欄に再掲
    kishuSeino: { x: 190, top: 160.6, width: 380, height: 12 },
    craneGyosha: { x: 190, top: 192.8, width: 158, height: 12 },
    untenshaMei: { x: 422, top: 192.8, width: 148, height: 20 },
  };

  // 作業計画(107-118): 単一値(列①のみ使用)
  const WORK = {
    yoteiJikan: { x: 190, top: 256.8, width: 120, height: 22 },
    shiyoGyosha: { x: 190, top: 284.2, width: 120, height: 12 },
    basho: { x: 190, top: 309.0, width: 120, height: 12 },
    naiyo: { x: 190, top: 339.8, width: 120, height: 12 },
    choKaJuryo: { x: 190, top: 363.1, width: 100, height: 12 },
    sagyoHankei: { x: 190, top: 378.6, width: 100, height: 12 },
    slingKei: { x: 190, top: 394.0, width: 70, height: 10 },
    slingNagasa: { x: 190, top: 407.8, width: 55, height: 10 },
    slingHon: { x: 262.2, top: 407.8, width: 45, height: 10 },
    sekininsha: { x: 190, top: 424.0, width: 120, height: 12 },
    tamakakesha: { x: 190, top: 444.1, width: 120, height: 12 },
    aizusha: { x: 190, top: 465.3, width: 120, height: 12 },
  };

  // 安全チェック(119-126)ラベル位置(白抜きのみ。値はチェックボックスで表現するため描画不要)
  const SAFETY_LABELS = {
    aizuHoho: { x: 238.1, top: 481.8, width: 30, height: 8 },
    chikei: { x: 238.1, top: 494.2, width: 30, height: 8 },
    jibanKyodo: { x: 238.1, top: 506.7, width: 30, height: 8 },
    jibanYojo: { x: 238.1, top: 517.8, width: 30, height: 8 },
    outriggerJotai: { x: 238.1, top: 542.5, width: 30, height: 8 },
    creneShui: { x: 238.1, top: 562.2, width: 30, height: 8 },
    tsuriniKabu: { x: 238.1, top: 581.8, width: 30, height: 8 },
    kakusenKinsetsu: { x: 238.1, top: 606.1, width: 30, height: 8 },
    outriggerFukaDetail: { x: 380, top: 537.5, width: 190, height: 9 }, // 「不可：対策」選択時の詳細内容
    kakusenOtherDetail: { x: 400, top: 606.5, width: 170, height: 9 }, // 架空線近接「その他」選択時の詳細内容
  };

  // チェックボックス選択肢位置(□グリフ中心。マーク描画に使用)
  const CHECKBOXES = {
    aizuHoho: [
      { label: '無線', x: 327.7, y: 485.0 }, { label: '手合図', x: 364.2, y: 485.0 }, { label: '笛', x: 411.5, y: 485.0 },
    ],
    chikei: [
      { label: '平地', x: 327.7, y: 497.5 }, { label: '傾斜地', x: 364.2, y: 497.5 },
    ],
    jibanKyodo: [
      { label: '堅固', x: 318.6, y: 510.0 }, { label: '普通', x: 346.0, y: 510.0 }, { label: '軟弱', x: 373.3, y: 510.0 }, { label: '埋設物', x: 400.6, y: 510.0 },
    ],
    jibanYojo: [
      { label: '皿受け', x: 327.7, y: 520.5 }, { label: '敷鉄板', x: 373.3, y: 520.5 },
      { label: '地盤改良', x: 327.7, y: 530.5 }, { label: '良質盛土', x: 373.3, y: 530.5 }, { label: '無', x: 422.5, y: 530.5 },
    ],
    outriggerJotai: [
      { label: '不可:対策', x: 318.6, y: 540.8 }, { label: '可', x: 318.6, y: 550.7 }, { label: '無', x: 346.0, y: 550.7 },
    ],
    creneShui: [
      { label: 'バリケード', x: 318.6, y: 560.5 }, { label: 'ロープ', x: 373.3, y: 560.5 }, { label: 'カラーコーン', x: 318.6, y: 570.3 },
    ],
    tsuriniKabu: [
      { label: '誘導員', x: 318.6, y: 580.2 }, { label: '声', x: 364.2, y: 580.2 }, { label: '笛', x: 382.4, y: 580.2 }, { label: 'ブザー', x: 411.6, y: 580.2 },
      { label: 'カラーコーン', x: 318.6, y: 590.0 }, { label: 'ロープ', x: 391.6, y: 590.0 },
    ],
    kakusenKinsetsu: [
      { label: '有:対策', x: 318.6, y: 599.9 }, { label: '移設', x: 364.2, y: 599.9 }, { label: '絶縁用防具', x: 391.6, y: 599.9 },
      { label: '監視員', x: 318.6, y: 610.4 }, { label: 'その他', x: 355.0, y: 610.4 },
      { label: '無', x: 318.6, y: 619.2 },
    ],
  };

  // 元請担当者確認欄(127・128)
  const CONFIRM = {
    tantosha127: { x: 238.1, top: 640.2, width: 100, height: 18 },
    tantosha127_dup: { x: 509.0, top: 695.8, width: 100, height: 18 },
    kyoryokuKakuninsha128: { x: 397.8, top: 778.4, width: 90, height: 10 },
  };

  // 吊り荷計画(129-144・作業予定①②③、最大3回繰り返し)。基準は列①。列②③は列オフセットを加算する。
  const COL_OFFSETS = [0, 129.6, 259.2];
  const LIFT = {
    tsuriniMeisho: { x: 730, top: 500.0, width: 122, height: 10 },
    hitsuyoHankei: { x: 730, top: 522.3, width: 100, height: 10 },
    hitsuyoTakasa: { x: 730, top: 542.0, width: 100, height: 10 },
    niSoJuryo: { x: 730, top: 561.7, width: 90, height: 10 },
    ikkaiJuryo: { x: 730, top: 581.4, width: 90, height: 10 },
    boomNagasa: { x: 736, top: 601.0, width: 36, height: 10 },
    jibNagasa: { x: 805, top: 601.0, width: 36, height: 10 },
    teikakuSokaJu: { x: 730, top: 620.6, width: 100, height: 10 },
    hookJuryo: { x: 730, top: 639.8, width: 100, height: 10 },
    teikakuKaJu: { x: 730, top: 659.5, width: 100, height: 10 },
    teikaku90: { x: 730, top: 680.1, width: 100, height: 10 },
    shogaiUmu: { x: 730, top: 701.0, width: 122, height: 10 },
    ichiKozo: { x: 730, top: 721.9, width: 122, height: 10 },
    saidaiSekisai: { x: 730, top: 742.4, width: 90, height: 10 },
    hokyoHitsuyo: { x: 730, top: 763.0, width: 122, height: 10 },
    balanceKeikaku: { x: 730, top: 783.6, width: 122, height: 10 },
  };

  // 画像/図面挿入枠(145、右ページ上部の赤枠)
  const IMAGE_FRAME = { x0: 601.8, y0: 189.0, x1: 1124.5, y1: 403.9 };

  return { PAGE_W, PAGE_H, HEADER, WORK, SAFETY_LABELS, CHECKBOXES, CONFIRM, LIFT, COL_OFFSETS, IMAGE_FRAME };
})();
