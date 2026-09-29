/**
 * Realtime updates with Server-Sent Events (SSE).
 * Every time a seat changes, all open browsers receive fresh quota numbers,
 * so the landing page and program cards update live without refreshing.
 */
import { programRepository } from '../repositories/programRepository.js';
import { config } from '../config.js';

const clients = new Set();

/** Public snapshot shown on the landing page and program list. */
export function publicSnapshot() {
  const programs = programRepository.listWithCounts();
  const totalCapacity = programs.reduce((s, p) => s + p.capacity, 0);
  const applicants = programs.reduce((s, p) => s + p.applicants, 0);
  const submitted = programs.reduce((s, p) => s + p.submitted, 0);
  const anySeat = programs.some((p) => p.availability !== 'FULL');
  return {
    programs,
    stats: {
      totalPrograms: programs.length,
      totalCapacity,
      applicants, // seats taken (selected + submitted)
      submitted,
      availableSeats: Math.max(0, totalCapacity - applicants),
      fullPrograms: programs.filter((p) => p.availability === 'FULL').length,
      status: config.registrationOpen && anySeat ? 'OPEN' : 'CLOSED',
    },
    updatedAt: new Date().toISOString(),
  };
}

export function subscribe(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n');
  res.write(`event: snapshot\ndata: ${JSON.stringify(publicSnapshot())}\n\n`);
  clients.add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(ping); clients.delete(res); });
}

let pending = null;
/** Broadcast (debounced so a burst of 50 selections sends one update). */
export function broadcastSnapshot() {
  if (pending) return;
  pending = setTimeout(() => {
    pending = null;
    if (!clients.size) return;
    const msg = `event: snapshot\ndata: ${JSON.stringify(publicSnapshot())}\n\n`;
    for (const res of clients) res.write(msg);
  }, 150);
}
