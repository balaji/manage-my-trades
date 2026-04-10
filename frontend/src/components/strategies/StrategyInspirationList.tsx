import React from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { strategyInspirations } from './strategyInspirations';

interface StrategyInspirationListProps {
  title?: string;
  description?: string;
}

export function StrategyInspirationList({
  title = 'Popular Strategies',
  description = 'Browse popular strategy archetypes and technical-indicator ideas.',
}: StrategyInspirationListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-1">
          {strategyInspirations.map((inspiration) => (
            <div
              key={inspiration.id}
              className="rounded-lg border border-border bg-muted/30 p-4 transition-colors hover:bg-muted/50"
            >
              <h3 className="font-medium text-foreground">{inspiration.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{inspiration.description}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
