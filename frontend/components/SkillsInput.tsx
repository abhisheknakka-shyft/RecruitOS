"use client";

import { useState, KeyboardEvent, ClipboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

function parsePastedSkills(text: string): string[] {
  return text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function SkillsInput({
  value,
  onChange,
  placeholder = "Type a skill and press Enter, or paste comma-separated skills",
  className,
}: {
  value: string[];
  onChange: (skills: string[]) => void;
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

  const addMany = (skills: string[]) => {
    const added = [...new Set(skills)].filter((s) => s && !value.includes(s));
    if (added.length) onChange([...value, ...added]);
  };

  const remove = (skill: string) => {
    onChange(value.filter((x) => x !== skill));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    const skills = parsePastedSkills(pasted);
    if (skills.length > 0) {
      e.preventDefault();
      addMany(skills);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Label>Skills / Keywords</Label>
      <div className="flex flex-wrap gap-2 rounded-md border border-input bg-background px-3 py-2">
        {value.map((skill) => (
          <Badge key={skill} variant="secondary" className="gap-1 pr-1">
            {skill}
            <button
              type="button"
              onClick={() => remove(skill)}
              className="rounded-full p-0.5 hover:bg-muted-foreground/20"
              aria-label={`Remove ${skill}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={add}
          placeholder={placeholder}
          className="min-w-[140px] flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
        />
      </div>
    </div>
  );
}
