import { describe, expect, it } from 'vitest';
import { getGroupParts, groupUserBases, parseUserIds, partName, splitIntoParts } from '@/lib/user-ids';
import type { UserBase } from '@/types';

const base = (id: string, extra: Partial<UserBase> = {}): UserBase => ({
  id,
  name: id,
  type: 'static',
  rawUserIds: '',
  userCount: 10,
  createdAt: new Date(2026, 0, 1),
  ...extra,
} as UserBase);

describe('parseUserIds', () => {
  it('accepts any separator, drops junk and duplicates, keeps order', () => {
    expect(parseUserIds('3, 1;2\n\n3\t5 abc -4 0 1.5 12x')).toEqual([3, 1, 2, 5]);
  });
  it('returns [] for empty input', () => {
    expect(parseUserIds('')).toEqual([]);
    expect(parseUserIds(undefined)).toEqual([]);
  });
});

describe('splitIntoParts', () => {
  it('splits with a shorter tail', () => {
    expect(splitIntoParts([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it('keeps a single part when everything fits', () => {
    expect(splitIntoParts([1, 2], 10)).toEqual([[1, 2]]);
  });
  it('100k by 30k gives 4 parts', () => {
    const parts = splitIntoParts(Array.from({ length: 100_000 }, (_, i) => i), 30_000);
    expect(parts.map((p) => p.length)).toEqual([30_000, 30_000, 30_000, 10_000]);
  });
  it('rejects a bad size', () => {
    expect(() => splitIntoParts([1], 0)).toThrow();
  });
});

describe('groups', () => {
  const bases = [
    base('solo'),
    base('p2', { groupId: 'g', groupName: 'PROMO', partIndex: 2 }),
    base('p10', { groupId: 'g', groupName: 'PROMO', partIndex: 10 }),
    base('p1', { groupId: 'g', groupName: 'PROMO', partIndex: 1 }),
    base('other'),
  ];

  it('names parts with a numeric suffix', () => {
    expect(partName('PROMO-СВОИ', 3)).toBe('PROMO-СВОИ_3');
  });

  it('orders parts numerically', () => {
    expect(getGroupParts(bases, 'g').map((b) => b.id)).toEqual(['p1', 'p2', 'p10']);
  });

  it('collapses parts into one entry and keeps standalone bases', () => {
    const entries = groupUserBases(bases);
    expect(entries.map((e) => (e.kind === 'base' ? e.base.id : `group:${e.group.name}`))).toEqual([
      'solo',
      'group:PROMO',
      'other',
    ]);
    const group = entries[1].kind === 'group' ? entries[1].group : undefined;
    expect(group?.parts.map((b) => b.id)).toEqual(['p1', 'p2', 'p10']);
    expect(group?.userCount).toBe(30);
  });
});
