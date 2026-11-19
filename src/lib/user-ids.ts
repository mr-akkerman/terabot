import type { UserBase } from '@/types';

/**
 * Parses a raw ID list (separators: whitespace, comma, semicolon, newline).
 * Keeps only positive integers and drops duplicates, preserving order.
 * This is the only ID parser: both the base form and the sender use it, so
 * the count shown in the UI always matches what is actually sent.
 */
export function parseUserIds(raw: string | undefined | null): number[] {
  if (!raw) return [];
  const seen = new Set<number>();
  for (const token of raw.split(/[\s,;]+/)) {
    if (!token) continue;
    const id = Number(token);
    if (Number.isInteger(id) && id > 0) seen.add(id);
  }
  return [...seen];
}

/** Splits a list into parts of `size` items (the last one may be shorter). */
export function splitIntoParts<T>(items: T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new Error('Part size must be a positive integer');
  const parts: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    parts.push(items.slice(i, i + size));
  }
  return parts;
}

/** Name of a group part: PROMO-TEAM → PROMO-TEAM_1, PROMO-TEAM_2, … */
export function partName(groupName: string, partIndex: number): string {
  return `${groupName}_${partIndex}`;
}

export interface UserBaseGroup {
  id: string;
  name: string;
  /** Parts in sending order */
  parts: UserBase[];
  userCount: number;
  createdAt: Date;
}

/** Parts of one group in sending order. */
export function getGroupParts(bases: UserBase[], groupId: string): UserBase[] {
  return bases
    .filter((base) => base.groupId === groupId)
    .sort((a, b) => (a.partIndex ?? 0) - (b.partIndex ?? 0));
}

export type UserBaseEntry =
  | { kind: 'base'; base: UserBase }
  | { kind: 'group'; group: UserBaseGroup };

/**
 * Collapses a flat list of bases: the parts of a group become a single entry
 * (placed where its first part was found), standalone bases stay as they are.
 */
export function groupUserBases(bases: UserBase[]): UserBaseEntry[] {
  const entries: UserBaseEntry[] = [];
  const groups = new Map<string, UserBaseGroup>();

  for (const base of bases) {
    if (!base.groupId) {
      entries.push({ kind: 'base', base });
      continue;
    }
    let group = groups.get(base.groupId);
    if (!group) {
      group = { id: base.groupId, name: base.groupName ?? base.name, parts: [], userCount: 0, createdAt: base.createdAt };
      groups.set(base.groupId, group);
      entries.push({ kind: 'group', group });
    }
    group.parts.push(base);
    group.userCount += base.userCount ?? 0;
    if (base.createdAt < group.createdAt) group.createdAt = base.createdAt;
  }

  for (const group of groups.values()) {
    group.parts.sort((a, b) => (a.partIndex ?? 0) - (b.partIndex ?? 0));
  }
  return entries;
}
