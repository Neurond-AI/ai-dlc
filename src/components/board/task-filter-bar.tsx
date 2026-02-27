"use client";

import React, { useState } from "react";
import { Search, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUIStore } from "@/stores/ui-store";
import { useTaskFilters } from "@/hooks/use-task-filters";
import {
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  type TaskCategory,
  type TaskPriority,
} from "@/types/task";

export function TaskFilterBar() {
  const openTaskModal = useUIStore((s) => s.openTaskModal);
  const { filter, setSearch, setCategory, setPriority, clearFilters, hasActiveFilters } =
    useTaskFilters();

  const [searchValue, setSearchValue] = useState(filter.search);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    setSearch(value);
  };

  return (
    <div
      className="flex flex-wrap items-center gap-2 pb-4"
      data-testid="task-filter-bar"
    >
      {/* Search input */}
      <div className="relative flex-1 min-w-[180px] max-w-sm">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search tasks..."
          value={searchValue}
          onChange={handleSearchChange}
          className="pl-8"
          data-testid="task-search-input"
        />
      </div>

      {/* Category filter */}
      <Select
        value={filter.category ?? "all"}
        onValueChange={(v) =>
          setCategory(v === "all" ? null : (v as TaskCategory))
        }
      >
        <SelectTrigger
          className="w-[140px]"
          data-testid="task-category-filter"
        >
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {TASK_CATEGORIES.map((cat) => (
            <SelectItem key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Priority filter */}
      <Select
        value={filter.priority ?? "all"}
        onValueChange={(v) =>
          setPriority(v === "all" ? null : (v as TaskPriority))
        }
      >
        <SelectTrigger
          className="w-[130px]"
          data-testid="task-priority-filter"
        >
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Priorities</SelectItem>
          {TASK_PRIORITIES.map((p) => (
            <SelectItem key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          data-testid="task-clear-filters-btn"
        >
          <X className="h-4 w-4" />
          Clear
        </Button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* New Task button */}
      <Button onClick={openTaskModal} data-testid="new-task-btn">
        <Plus className="h-4 w-4" />
        New Task
      </Button>
    </div>
  );
}
