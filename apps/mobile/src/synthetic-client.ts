// Bundled fixtures only. This module never calls fetch or a native HTTP plugin.
const people = ['Alex', 'Robin', 'Sam', 'Taylor', 'Morgan', 'Casey'].map((firstName, i) => ({
  id: `synthetic-${i}`, firstName, lastName: 'Example', label: `${firstName} Example`,
  nickname: null, company: null, position: null, city: null, country: null,
  email: null, phone: null, notes: null, primaryTag: null, importance: i % 5 + 1,
  networkCircle: ['INNER', 'MIDDLE', 'OUTER'][i % 3], categories: [], interests: [],
  createdAt: '2026-01-01', updatedAt: '2026-01-01',
}));
const routes: Record<string, unknown> = {
  '/api/v1/people': people,
  '/api/v1/graph': { nodes: people, edges: [], meta: { nodeCount: 6, edgeCount: 0 } },
  '/api/v1/analytics/network': { nodes: [], meta: { nodeCount: 6, edgeCount: 0, density: 0, communityCount: 0, modularity: 0 }, rankings: { connectors: [], strongestNetworks: [], bridges: [] } },
  '/api/v1/graph-styles': {},
  '/api/v1/categories': [], '/api/v1/interests': [], '/api/v1/relationships': [],
  '/api/v1/relationship-styles': [], '/api/v1/reminders/upcoming': [], '/api/v1/reminders/history': [],
};
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  init.signal?.throwIfAborted();
  if ((init.method ?? 'GET').toUpperCase() !== 'GET') {
    throw new Error('Saving is disabled in this offline prototype.');
  }
  const url = new URL(path, 'https://synthetic.invalid');
  if (url.origin !== 'https://synthetic.invalid') throw new Error('External requests are disabled.');
  const key = url.pathname;
  if (Object.hasOwn(routes, key)) return Response.json(routes[key]);
  const match = key.match(/^\/api\/v1\/people\/(synthetic-\d+)(?:\/(contact-events|contact-channels))?$/);
  if (match) {
    const person = people.find(p => p.id === match[1]);
    if (person) return Response.json(match[2] ? [] : person);
  }
  return Response.json({ error: 'Not available in this prototype' }, { status: 404 });
}
export function onSessionExpired(_listener: () => void) { return () => {}; }
