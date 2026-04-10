import { Badge } from '@/components/ui/badge';

const variantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline',
  running: 'secondary',
  completed: 'default',
  failed: 'destructive',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={variantMap[status] ?? 'outline'} className="capitalize">
      {status}
    </Badge>
  );
}
