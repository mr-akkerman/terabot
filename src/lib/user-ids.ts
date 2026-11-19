import type { UserBase } from '@/types';

/**
 * Разбирает «сырой» список ID (разделители: пробел, запятая, точка с запятой, перенос строки).
 * Оставляет только положительные целые и убирает дубликаты, сохраняя порядок.
 * Это единственный парсер ID: его используют и форма базы, и рассылка, поэтому
 * количество в интерфейсе всегда совпадает с тем, что реально уйдёт в отправку.
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

/** Режет список на части по `size` элементов (последняя может быть короче). */
export function splitIntoParts<T>(items: T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new Error('Part size must be a positive integer');
  const parts: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    parts.push(items.slice(i, i + size));
  }
  return parts;
}

/** Имя части группы: PROMO-СВОИ → PROMO-СВОИ_1, PROMO-СВОИ_2, … */
export function partName(groupName: string, partIndex: number): string {
  return `${groupName}_${partIndex}`;
}

export interface UserBaseGroup {
  id: string;
  name: string;
  /** Части в порядке рассылки */
  parts: UserBase[];
  userCount: number;
  createdAt: Date;
}

/** Части одной группы в порядке рассылки. */
export function getGroupParts(bases: UserBase[], groupId: string): UserBase[] {
  return bases
    .filter((base) => base.groupId === groupId)
    .sort((a, b) => (a.partIndex ?? 0) - (b.partIndex ?? 0));
}

export type UserBaseEntry =
  | { kind: 'base'; base: UserBase }
  | { kind: 'group'; group: UserBaseGroup };

/**
 * Сворачивает плоский список баз: части одной группы превращаются в одну запись
 * (на месте первой встреченной части), одиночные базы остаются как есть.
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
