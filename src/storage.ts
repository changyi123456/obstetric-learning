import { POSITIONS, type PositionCode, type PoseCode, type LearningMode, shuffledRound } from './positions';
export const STORAGE_KEY = 'obstetric-learning.progress.v1';
export type Attempt = { id: string; question: number; expected: PositionCode; answer: PositionCode; correct: boolean; at: string };
export type Progress = { version: 1; mode: LearningMode; pose: PoseCode; lesson: number; lessonCompleted: boolean; visited: PoseCode[]; round: PositionCode[]; index: number; attempts: Attempt[]; submitted: PositionCode | null; complete: boolean; roundId: string };
export function newProgress(): Progress { return { version: 1, mode: 'lesson', pose: 'LOA', lesson: 0, lessonCompleted: false, visited: ['LOA'], round: [], index: 0, attempts: [], submitted: null, complete: false, roundId: '' }; }
export function beginRound(p: Progress): Progress { return { ...p, mode: 'quiz', round: shuffledRound(), index: 0, submitted: null, complete: false, roundId: crypto.randomUUID() }; }
export function submitAttempt(p: Progress, answer: PositionCode, now = new Date().toISOString()): Progress {
  if (p.submitted || p.complete || !p.round[p.index]) return p;
  const expected = p.round[p.index];
  return { ...p, submitted: answer, attempts: [...p.attempts, { id: `${p.roundId}:${p.index}:${p.attempts.filter(a => a.question === p.index && a.id.startsWith(p.roundId)).length}`, question: p.index, expected, answer, correct: expected === answer, at: now }] };
}
export function nextQuestion(p: Progress): Progress {
  if (!p.submitted) return p;
  return p.index === p.round.length - 1 ? { ...p, complete: true } : { ...p, index: p.index + 1, submitted: null };
}
export function readProgress(storage: Pick<Storage,'getItem'> = localStorage): Progress {
  try {
    const raw = storage.getItem(STORAGE_KEY); if (!raw) return newProgress();
    const p = JSON.parse(raw) as Progress;
    const poses = [...POSITIONS.map(x => x.code),'OA','OP'];
    if (p.version !== 1 || !['lesson','explore','quiz'].includes(p.mode) || !poses.includes(p.pose) || !Number.isInteger(p.lesson) || p.lesson < 0 || p.lesson > 2 || !Array.isArray(p.round) || !p.round.every(x => POSITIONS.some(y => y.code === x)) || !Number.isInteger(p.index) || p.index < 0 || p.index > 5 || !Array.isArray(p.visited) || !Array.isArray(p.attempts) || !p.attempts.every(a=>a && typeof a.correct === 'boolean' && typeof a.id === 'string' && POSITIONS.some(y=>y.code===a.expected) && POSITIONS.some(y=>y.code===a.answer)) || (p.mode === 'quiz' && p.round.length !== 6)) return newProgress();
    return p;
  } catch { return newProgress(); }
}
