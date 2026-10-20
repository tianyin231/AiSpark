// 二十四节气（近似日期，各年份前后误差约 1 天，仅用于编年展示的氛围）
const TERMS = [
  [1, 5, '小寒'], [1, 20, '大寒'], [2, 4, '立春'], [2, 19, '雨水'],
  [3, 5, '惊蛰'], [3, 20, '春分'], [4, 5, '清明'], [4, 20, '谷雨'],
  [5, 5, '立夏'], [5, 21, '小满'], [6, 6, '芒种'], [6, 21, '夏至'],
  [7, 7, '小暑'], [7, 23, '大暑'], [8, 7, '立秋'], [8, 23, '处暑'],
  [9, 7, '白露'], [9, 23, '秋分'], [10, 8, '寒露'], [10, 23, '霜降'],
  [11, 7, '立冬'], [11, 22, '小雪'], [12, 7, '大雪'], [12, 21, '冬至'],
];

const CN_MONTH = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];

/** 某月包含的两个节气 */
export function monthTerms(month) {
  return TERMS.filter(([m]) => m === month).map(([, , n]) => n);
}

/** 某日所处的节气（取不晚于该日的最近一个节气） */
export function termOf(month, day) {
  let cur = TERMS[TERMS.length - 1][2]; // 一月初仍属上一年冬至
  for (const [m, d, n] of TERMS) {
    if (m < month || (m === month && d <= day)) cur = n;
  }
  return cur;
}

export function cnMonth(month) {
  return `${CN_MONTH[month - 1]}月`;
}
