import type { EmailEntry, Source } from './types';
export function deduplicate(entries: EmailEntry[]) {
  const groups = new Map<string, { entry: EmailEntry; sources: Source[] }>();
  for (const entry of entries) {
    const email = entry.email.trim().toLowerCase();
    const group = groups.get(email);
    if (group) group.sources.push(entry.source);
    else groups.set(email, { entry: { ...entry, email }, sources: [entry.source] });
  }
  return {
    unique: [...groups.values()].map((g) => ({
      ...g.entry,
      occurrences: g.sources.length,
      isValid: true,
    })),
    duplicates: [...groups.values()]
      .filter((g) => g.sources.length > 1)
      .map((g) => ({ email: g.entry.email, count: g.sources.length, sources: g.sources })),
    totalDuplicatesRemoved: entries.length - groups.size,
  };
}
