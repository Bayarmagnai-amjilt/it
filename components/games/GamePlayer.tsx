'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Confetti } from '@/components/Confetti';
import { buttonClass, cn } from '@/components/ui';
import { savePuzzle } from '@/features/quizzes/student';
import { fill } from '@/lib/errors';
import type { GameWorkspace } from '@/lib/games/blocks';
import { starsFor, type FailReason, type Level, type RunResult } from '@/lib/games/types';
import { mn } from '@/locales/mn';
import { BirdStage, MazeStage, TurtleStage } from './Stages';

const PROGRESS_KEY = 'games:progress';
const draftKey = (level: Level) => `games:ws:${level.game}:${level.level}`;

// Browser storage can be missing (private window, blocked site data): never rely on it.
function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked: the game still works
  }
}

function failed(level: Level, reason: FailReason): RunResult {
  if (level.game === 'maze') return { game: 'maze', ok: false, reason, steps: [] };
  if (level.game === 'bird') return { game: 'bird', ok: false, reason, frames: [], collected: [] };
  return { game: 'turtle', ok: false, reason, steps: [] };
}

/** Runs the program in a fresh Web Worker; gives up after 2 seconds of running. */
function runInWorker(level: Level, code: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL('../../lib/games/runner.worker.ts', import.meta.url), { type: 'module' });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (result: RunResult) => {
      clearTimeout(timer);
      worker.terminate();
      resolve(result);
    };
    worker.onmessage = (event: MessageEvent<RunResult | 'ready'>) => {
      if (event.data === 'ready') {
        // the clock starts once the worker is loaded, so a slow first load is not a "timeout"
        timer = setTimeout(() => finish(failed(level, 'timeout')), 2000);
        worker.postMessage({ level, code });
      } else finish(event.data);
    };
    worker.onerror = () => finish(failed(level, 'error'));
  });
}

const stepsOf = (r: RunResult) => (r.game === 'bird' ? r.frames.length : r.steps.length);

export function GamePlayer({
  level,
  total,
  serverProgress,
}: {
  level: Level;
  total: number;
  /** stars per "game:level" for a logged-in student; null for a guest */
  serverProgress: Record<string, number> | null;
}) {
  const host = useRef<HTMLDivElement>(null);
  const ws = useRef<GameWorkspace | null>(null);
  const animation = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [blocks, setBlocks] = useState(0);
  const [result, setResult] = useState<RunResult | null>(null);
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<{ ok: boolean; stars?: number; reason?: FailReason } | null>(null);
  const [saved, setSaved] = useState(false);
  const [hint, setHint] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>(serverProgress ?? {});

  // a guest's stars live in this browser only
  useEffect(() => {
    if (!serverProgress) setProgress(readJson(PROGRESS_KEY, {}));
  }, [serverProgress]);
  const unlocked = level.level === 1 || (progress[`${level.game}:${level.level - 1}`] ?? 0) > 0;

  useEffect(() => {
    if (!unlocked || !host.current) return;
    let disposed = false;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    void import('@/lib/games/blocks').then(({ createWorkspace }) => {
      if (disposed || !host.current) return;
      const created = createWorkspace(host.current, level, readJson<object | null>(draftKey(level), null), () => {
        setBlocks(created.blockCount());
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => writeJson(draftKey(level), created.save()), 400);
      });
      ws.current = created;
      setBlocks(created.blockCount());
    });
    return () => {
      disposed = true;
      clearTimeout(saveTimer);
      ws.current?.dispose();
      ws.current = null;
    };
  }, [level, unlocked]);

  const stop = useCallback(() => {
    if (animation.current) clearTimeout(animation.current);
    animation.current = null;
    ws.current?.highlight(null);
  }, []);
  useEffect(() => stop, [stop]);

  const reset = () => {
    stop();
    setRunning(false);
    setResult(null);
    setIndex(0);
    setOutcome(null);
    setSaved(false);
  };

  const finishRun = async (r: RunResult, count: number) => {
    setRunning(false);
    ws.current?.highlight(null);
    if (!r.ok) {
      setOutcome({ ok: false, reason: r.reason });
      return;
    }
    const stars = starsFor(count, level.stars);
    setOutcome({ ok: true, stars });
    const key = `${level.game}:${level.level}`;
    const best = Math.max(stars, progress[key] ?? 0);
    const next = { ...progress, [key]: best };
    setProgress(next);
    if (serverProgress) {
      const saveResult = await savePuzzle(level.game, level.level, ws.current?.save() ?? {}, count);
      setSaved(saveResult.ok);
    } else writeJson(PROGRESS_KEY, next);
  };

  const run = async () => {
    if (!ws.current || running) return;
    reset();
    setRunning(true);
    const count = ws.current.blockCount();
    const r = await runInWorker(level, ws.current.code());
    setResult(r);
    const length = stepsOf(r);
    if (length === 0) {
      void finishRun(r, count);
      return;
    }
    // birds fly in many small frames: skip some so a flight takes a few seconds at most
    const stride = r.game === 'bird' ? Math.max(1, Math.ceil(length / 160)) : 1;
    const delay = r.game === 'maze' ? 260 : r.game === 'bird' ? 25 : Math.min(150, Math.max(20, Math.round(1800 / length)));
    let i = 0;
    const tick = () => {
      i = Math.min(length, i + stride);
      setIndex(i);
      if (r.game !== 'bird') ws.current?.highlight(r.steps[i - 1]?.block ?? null);
      if (i < length) animation.current = setTimeout(tick, delay);
      else animation.current = setTimeout(() => void finishRun(r, count), 300);
    };
    tick();
  };

  if (!unlocked) {
    return (
      <div className="rounded-3xl border-[3px] border-ink-900 bg-white p-8 text-center shadow-brut">
        <p className="text-5xl" aria-hidden="true">🔒</p>
        <p className="mt-3 text-2xl font-extrabold text-ink-900">{mn.games.locked}</p>
        <Link href={`/games/${level.game}`} className={buttonClass('primary', 'lg', 'mt-5')}>
          {mn.games.backToLevels}
        </Link>
      </div>
    );
  }

  const stage =
    level.game === 'maze' ? (
      <MazeStage level={level} steps={result?.game === 'maze' ? result.steps : null} index={index} />
    ) : level.game === 'bird' ? (
      <BirdStage level={level} frames={result?.game === 'bird' ? result.frames : null} collected={result?.game === 'bird' ? result.collected : null} index={index} />
    ) : (
      <TurtleStage level={level} steps={result?.game === 'turtle' ? result.steps : null} index={index} />
    );
  const hasNext = level.level < total;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,26rem)_1fr]">
      <div className="space-y-4">
        <div className="rounded-2xl border-[3px] border-ink-900 bg-sun-100 px-4 py-3 font-bold text-ink-900 shadow-brut-sm">{level.goal}</div>
        {stage}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass('primary', 'lg', 'flex-1')} disabled={running} onClick={() => void run()}>
            ▶ {running ? mn.games.running : mn.games.run}
          </button>
          <button type="button" className={buttonClass('secondary', 'lg')} onClick={reset}>
            ↺ {mn.games.reset}
          </button>
          <button type="button" className={buttonClass('accent', 'lg')} aria-expanded={hint} onClick={() => setHint((h) => !h)}>
            💡 {mn.games.hint}
          </button>
        </div>
        {hint ? <p className="rounded-2xl border-2 border-dashed border-ink-300 bg-white px-4 py-3 font-semibold text-ink-800">{level.hint}</p> : null}
        <p className="text-sm font-semibold text-slate-600">
          {fill(mn.games.blocksUsed, { n: blocks })} · {fill(mn.games.starRule, { three: level.stars.three, two: level.stars.two })}
        </p>
        {outcome && !outcome.ok ? (
          <p className="rounded-2xl border-[3px] border-ink-900 bg-blush-100 px-4 py-3 text-lg font-bold text-ink-900" role="status">
            {outcome.reason ? mn.games.fail[outcome.reason] : mn.games.fail.not_finished}
          </p>
        ) : null}
        {!serverProgress ? <p className="text-xs font-semibold text-slate-500">{mn.games.guest}</p> : null}
      </div>

      <div ref={host} className="h-[34rem] min-h-80 overflow-hidden rounded-2xl border-[3px] border-ink-900 bg-white shadow-brut" />

      {outcome?.ok ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink-950/50 p-4" role="dialog" aria-modal="true">
          <Confetti />
          <div className="card-in w-full max-w-md space-y-4 rounded-3xl border-[3px] border-ink-900 bg-white p-8 text-center shadow-brut-lg">
            <p className="text-3xl font-extrabold text-ink-900">{mn.games.success}</p>
            <p className="text-5xl tracking-widest" aria-label={fill(mn.games.stars, { n: outcome.stars ?? 1 })}>
              {[1, 2, 3].map((s) => (
                <span key={s} className={cn(s <= (outcome.stars ?? 1) ? 'text-sun-500' : 'text-ink-200')}>
                  ★
                </span>
              ))}
            </p>
            <p className="font-bold text-slate-600">{fill(mn.games.blocksUsed, { n: blocks })}</p>
            {(outcome.stars ?? 3) < 3 ? <p className="text-sm font-semibold text-slate-600">{mn.games.tryFewer}</p> : null}
            {saved ? <p className="text-sm font-semibold text-ink-900">✓ {mn.games.saved}</p> : null}
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <button type="button" className={buttonClass('secondary', 'md')} onClick={reset}>
                ↺ {mn.games.reset}
              </button>
              {hasNext ? (
                <Link href={`/games/${level.game}/${level.level + 1}`} className={buttonClass('primary', 'md')}>
                  {mn.games.nextLevel} ▶
                </Link>
              ) : (
                <Link href="/games" className={buttonClass('primary', 'md')}>
                  {mn.games.allDone}
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
