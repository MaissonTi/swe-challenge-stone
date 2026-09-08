import { Button } from '@/components/ui/button';

type PaginationProps = {
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
};

/**
 * The API only exposes an opaque forward cursor (see specs/products:
 * "Paginated Listing") - there is no page-number/offset model to mirror,
 * so "previous" just walks back through the cursors this page has
 * already visited (see ProductsPage's cursor stack), not a fresh query.
 */
export function Pagination({
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}: PaginationProps) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={!hasPrevious}
        onClick={onPrevious}
      >
        Previous
      </Button>
      <Button variant="outline" size="sm" disabled={!hasNext} onClick={onNext}>
        Next
      </Button>
    </div>
  );
}
