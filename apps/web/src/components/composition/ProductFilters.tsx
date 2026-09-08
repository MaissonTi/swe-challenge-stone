import * as React from 'react';
import type { ProductCategory } from '@swe-challenge-stone/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CATEGORY_OPTIONS: ProductCategory[] = [
  'ELECTRONICS',
  'CLOTHING',
  'HOME',
  'BOOKS',
  'TOYS',
  'FOOD',
  'OTHER',
];

const ALL_CATEGORIES = 'ALL';

export type ProductFiltersValue = {
  category?: ProductCategory;
  name?: string;
};

type ProductFiltersProps = {
  value: ProductFiltersValue;
  onChange: (value: ProductFiltersValue) => void;
};

export function ProductFilters({ value, onChange }: ProductFiltersProps) {
  const [nameInput, setNameInput] = React.useState(value.name ?? '');

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onChange({ ...value, name: nameInput || undefined });
      }}
    >
      <div className="grid gap-1.5">
        <label className="text-sm font-medium">Category</label>
        <Select
          value={value.category ?? ALL_CATEGORIES}
          onValueChange={(category) =>
            onChange({
              ...value,
              category:
                category === ALL_CATEGORIES
                  ? undefined
                  : (category as ProductCategory),
            })
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
            {CATEGORY_OPTIONS.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <label className="text-sm font-medium">Name</label>
        <Input
          placeholder="Name prefix..."
          value={nameInput}
          onChange={(event) => setNameInput(event.target.value)}
          className="w-56"
        />
      </div>
      <Button type="submit" variant="secondary">
        Search
      </Button>
    </form>
  );
}
