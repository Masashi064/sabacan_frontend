"use client";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

export function PreferenceChipPicker({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(option: string) {
    onChange(
      selected.includes(option)
        ? selected.filter((s) => s !== option)
        : [...selected, option]
    );
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">No options available yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const isSelected = selected.includes(option);
            return (
              <Badge
                key={option}
                variant={isSelected ? "default" : "outline"}
                role="button"
                tabIndex={0}
                onClick={() => toggle(option)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggle(option);
                  }
                }}
                className="cursor-pointer select-none px-3 py-1"
              >
                {option}
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
