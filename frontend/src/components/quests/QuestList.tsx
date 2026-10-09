'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { teamApi, type Quest } from '@/lib/api';
import { cn } from '@/lib/utils';

export function QuestList() {
  const [quests, setQuests] = useState<Quest[]>([]);
  useEffect(() => {
    teamApi.quests().then(setQuests).catch(() => {});
  }, []);
  if (!quests.length) return null;

  return (
    <div className="mt-2 space-y-2">
      {quests.map((q) => (
        <div key={q.code} className={cn('rounded-xl border p-3', q.done ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-border')}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">{q.done ? '✅' : '🎯'} {q.title}</span>
            <span className="text-xs text-muted-foreground">{q.progress}/{q.target} · {q.reward}</span>
          </div>
          <p className="text-xs text-muted-foreground">{q.description}</p>
          {q.place_id && !q.done && <Link href={`/place/${q.place_id}`} className="text-xs text-primary underline">Ukázat místo dne</Link>}
        </div>
      ))}
    </div>
  );
}
