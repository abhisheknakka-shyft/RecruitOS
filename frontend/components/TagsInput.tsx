"use client";

import { useState, KeyboardEvent, ClipboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function parsePasted(text: string): string[] {
  return text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function TagsInput({
  label,
  value,
  onChange,
  placeholder = "Add or paste comma-separated values",
  className,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const s = input.trim();
    if (s && !value.includes(s)) {
      onChange([...value, s]);
      setInput("");
    }
  };

  const addMany = (items: string[]) => {
    const added = [...new Set(items)].filter((s) => s && !value.includes(s));
    if (added.length) onChange([...value, ...added]);
  };

  const remove = (item: string) => onChange(value.filter((x) => x !== item));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    const items = parsePasted(pasted);
    if (items.length > 0) {
      e.preventDefault();
      addMany(items);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="flex items-center gap-1.5">
        {label}
        {value.length > 0 && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
            {value.length}
          </span>
        )}
      </Label>
      <div className="flex flex-wrap gap-2 rounded-md border border-input bg-background px-3 py-2">
        {value.map((item) => (
          <Badge key={item} variant="secondary" className="gap-1 pr-1">
            {item}
            <button
              type="button"
              onClick={() => remove(item)}
              className="rounded-full p-0.5 hover:bg-muted-foreground/20"
              aria-label={`Remove ${item}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <div className="flex min-w-[120px] flex-1 items-center gap-1">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onBlur={add}
            placeholder={placeholder}
            className="flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full text-primary"
            onClick={add}
            aria-label="Add"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
