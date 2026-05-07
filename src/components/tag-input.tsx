"use client";

import { useEffect, useState } from "react";
import { Plus, Tag as TagIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { TagBadge } from "@/components/tag-badge";
import { TAG_MAX_LENGTH, TAGS_MAX_COUNT } from "@/lib/tags";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
};

type VocabEntry = { tag: string; count: number };

/**
 * Popover-driven tag input. Click "+ Add tag" → command palette with
 * search-or-create. Suggestions come from the user's existing tag vocabulary
 * (everything they've used on any doc), excluding tags already on this doc.
 * Stays in the parent form's dirty-tracking model — no API calls; the
 * containing form persists the array on save.
 */
export function TagInput({ value, onChange, label = "Tags" }: Props) {
  const [open, setOpen] = useState(false);
  const [vocab, setVocab] = useState<VocabEntry[]>([]);
  const [input, setInput] = useState("");
  const [selected, setSelected] = useState("");
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/tags")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data && Array.isArray(data.tags)) setVocab(data.tags);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  const normalized = input.trim().toLowerCase();

  function add(tag: string) {
    const next = tag.trim().toLowerCase();
    if (!next) return;
    if (/\s/.test(next)) {
      setHint("Tags can't contain spaces");
      return;
    }
    if (next.length > TAG_MAX_LENGTH) {
      setHint(`Tag too long (max ${TAG_MAX_LENGTH})`);
      return;
    }
    if (value.includes(next)) {
      setInput("");
      setHint(null);
      return;
    }
    if (value.length >= TAGS_MAX_COUNT) {
      setHint(`Limit is ${TAGS_MAX_COUNT} tags`);
      return;
    }
    onChange([...value, next]);
    setInput("");
    setHint(null);
  }

  function remove(tag: string) {
    onChange(value.filter((t) => t !== tag));
    setHint(null);
  }

  // Vocabulary entries not already on this doc.
  const suggestions = vocab.filter((v) => !value.includes(v.tag));
  const hasExactMatch = suggestions.some((s) => s.tag === normalized);
  const showCreate = normalized.length > 0 && !hasExactMatch;
  const atLimit = value.length >= TAGS_MAX_COUNT;

  function handleSelect(rawValue: string) {
    if (rawValue.startsWith("create:")) add(rawValue.slice(7));
    else add(rawValue);
  }

  return (
    <div className="space-y-1.5">
      <span className="block text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-paper-warm px-2 py-2">
        {value.map((tag) => (
          <TagBadge key={tag} name={tag} size="md" onRemove={() => remove(tag)} />
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={atLimit}
              className="h-6 px-2 text-xs text-muted hover:text-ochre-deep"
            >
              <Plus className="size-3.5" />
              Add tag
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto min-w-56 max-w-72 p-0"
            align="start"
          >
            <Command
              shouldFilter={true}
              loop
              value={selected}
              onValueChange={setSelected}
            >
              <CommandInput
                placeholder="Search or create tag…"
                value={input}
                onValueChange={(v) => {
                  setInput(v);
                  if (hint) setHint(null);
                }}
                maxLength={TAG_MAX_LENGTH}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && selected) {
                    e.preventDefault();
                    handleSelect(selected);
                  }
                }}
              />
              <CommandList>
                <CommandEmpty>
                  {normalized.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => add(normalized)}
                      className="w-full rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-[var(--accent)]"
                    >
                      Create &quot;{normalized}&quot;
                    </button>
                  ) : (
                    <span className="text-muted">Type to search or create</span>
                  )}
                </CommandEmpty>
                {showCreate && (
                  <CommandGroup>
                    <CommandItem
                      value={`create:${normalized}`}
                      onSelect={handleSelect}
                    >
                      <Plus className="size-4 text-muted" />
                      Create &quot;{normalized}&quot;
                    </CommandItem>
                  </CommandGroup>
                )}
                {suggestions.length > 0 && (
                  <CommandGroup heading="Your tags">
                    {suggestions.map((s) => (
                      <CommandItem
                        key={s.tag}
                        value={s.tag}
                        onSelect={handleSelect}
                      >
                        <TagIcon className="size-4 text-muted" />
                        <span className="flex-1">{s.tag}</span>
                        <span className="font-mono text-[0.6875rem] tabular-nums text-muted">
                          {s.count}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
            {hint && (
              <p className="px-3 pb-2 pt-1 text-xs text-ochre-deep">{hint}</p>
            )}
            {atLimit && !hint && (
              <p className="px-3 pb-2 pt-1 text-xs text-muted">
                Maximum of {TAGS_MAX_COUNT} tags reached
              </p>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
