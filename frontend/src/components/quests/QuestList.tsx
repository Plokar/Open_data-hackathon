'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CircleCheck, Target } from 'lucide-react';
import { teamApi, type Quest } from '@/lib/api';
import { coarsePosition } from '@/lib/game';
import { cn } from '@/lib/utils';

export function QuestList() {
  const [quests, setQuests] = useState<Quest[]>([]);
  useEffect(() => {
    coarsePosition().then(teamApi.quests).then(setQuests).catch(() => {});
  }, []);
  if (!quests.length) return <p className="mt-2 text-muted-foreground">Úkoly se objeví po prvním razítku.</p>;

  return (
    <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
      {quests.map((q) => {
        const Icon = q.done ? CircleCheck : Target;
        return (
          <li key={q.code} className="flex gap-3 p-4">
            <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', q.done ? 'text-trail-green' : 'text-trail-red')} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className={cn('font-semibold', q.done && 'text-muted-foreground line-through decoration-trail-green/60')}>{q.title}</span>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{q.progress}/{q.target}</span>
              </div>
              <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{q.description} Odměna: {q.reward}.</p>
              {q.place_id && !q.done && <Link href={`/place/${q.place_id}`} className="mt-1 inline-block text-sm font-semibold text-primary underline">Ukázat místo dne</Link>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
