// Web Worker that runs one block program. The page starts a fresh worker per
// run and terminates it after 2 seconds, so an endless loop cannot freeze the tab.
// Workers have no DOM or localStorage; the network and storage APIs are removed
// before any program runs, and run.ts shadows the rest inside the program.
import { runProgram } from './run.ts';
import type { Level } from './types.ts';

const send = self.postMessage.bind(self);
for (const name of [
  'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts', 'indexedDB', 'caches',
  'BroadcastChannel', 'Worker', 'SharedWorker', 'eval', 'navigator',
]) {
  try {
    Object.defineProperty(self, name, { value: undefined, configurable: false, writable: false });
  } catch {
    // not every global exists in every browser
  }
}

self.onmessage = (event: MessageEvent<{ level: Level; code: string }>) => {
  send(runProgram(event.data.level, String(event.data.code)));
};

send('ready');
