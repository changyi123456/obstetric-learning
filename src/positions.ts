export const POSITIONS = [
  { code: 'LOA', name: '左枕前位', side: '左', direction: '前', angle: 45 },
  { code: 'LOT', name: '左枕橫位', side: '左', direction: '橫', angle: 90 },
  { code: 'LOP', name: '左枕後位', side: '左', direction: '後', angle: 135 },
  { code: 'ROA', name: '右枕前位', side: '右', direction: '前', angle: -45 },
  { code: 'ROT', name: '右枕橫位', side: '右', direction: '橫', angle: -90 },
  { code: 'ROP', name: '右枕後位', side: '右', direction: '後', angle: -135 },
] as const;
export type PositionCode = typeof POSITIONS[number]['code'];
export type PoseCode = PositionCode | 'OA' | 'OP';
export type LearningMode = 'lesson' | 'explore' | 'quiz';
export function getPosition(code: PoseCode) {
  return POSITIONS.find(p => p.code === code) ?? { code, name: code === 'OA' ? '枕前位' : '枕後位', side: '', direction: code === 'OA' ? '前' : '後', angle: code === 'OA' ? 0 : 180 };
}
export function normalizeAnswer(input: string) { return input.trim().toUpperCase(); }
export function validateAnswer(input: string): PositionCode | null {
  const value = normalizeAnswer(input);
  return POSITIONS.some(p => p.code === value) ? value as PositionCode : null;
}
export function shuffledRound(random: () => number = Math.random): PositionCode[] {
  const codes: PositionCode[] = POSITIONS.map(p => p.code);
  for (let i = codes.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [codes[i], codes[j]] = [codes[j], codes[i]];
  }
  return codes;
}
export function explainAnswer(expected: PositionCode, answer: PositionCode) {
  const target = getPosition(expected), chosen = getPosition(answer);
  if (expected === answer) return `判讀正確。枕部位於母體${target.side}側、朝${target.direction}方，所以是 ${expected}（${target.name}）。`;
  const errors = [target.side !== chosen.side ? `左右方向：這是母體${target.side}側，請以母體為基準，不能直接使用螢幕左右。` : '', target.direction !== chosen.direction ? `枕部朝向：這一題朝${target.direction}方，對應 ${expected[2]}。` : ''].filter(Boolean);
  return errors.join(' ') + ` 正確答案是 ${expected}（${target.name}）。`;
}
export const LESSONS = [
  { title: '先找到母體方向', text: '先辨識母體的前、後、左、右，再觀察胎兒。畫面左右會隨觀察視角改變，母體方向保持不變。', focus: '母體方向', tip: '切換「俯視」，觀察恥骨聯合在前方、薦骨在後方。' },
  { title: '找到胎兒枕部', text: '枕部是胎頭後方的部位。開啟枕部標記，沿著胎兒的背側找到後腦，再比較它與母體骨盆的位置。', focus: '胎兒枕部', tip: '青綠色標記指向枕部；臉部在相反的一側。' },
  { title: '組合胎位代號', text: '依序讀出母體左／右（L／R）、枕部（O）、前／橫／後（A／T／P）。先看懂每個字母，再開始自我測驗。', focus: '三字母代號', tip: '以 LOA 為例：L 是母體左側，O 是枕部，A 是朝前。' },
] as const;
