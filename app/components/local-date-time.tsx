"use client";

import { useEffect, useMemo, useState } from "react";

type LocalDateTimeProps = {
  value: string | null | undefined;
  emptyLabel?: string;
  kind?: "dateTime" | "date";
};

function parseLocalDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const [, yearValue, monthValue, dayValue] = match;
  const parsed = new Date(
    Number(yearValue),
    Number(monthValue) - 1,
    Number(dayValue),
    0,
    0,
    0,
    0,
  );

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatValue(value: string, kind: "dateTime" | "date"): string | null {
  if (kind === "date") {
    const parsedDate = parseLocalDateInput(value);

    if (!parsedDate) {
      return value;
    }

    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(parsedDate);
  }

  const parsedDateTime = new Date(value);

  if (Number.isNaN(parsedDateTime.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsedDateTime);
}

export function LocalDateTime({
  value,
  emptyLabel = "—",
  kind = "dateTime",
}: LocalDateTimeProps) {
  const [formatted, setFormatted] = useState<string>(emptyLabel);

  const dateTimeValue = useMemo(() => {
    if (!value) {
      return undefined;
    }

    if (kind === "date") {
      const parsed = parseLocalDateInput(value);
      return parsed ? parsed.toISOString() : undefined;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }, [kind, value]);

  useEffect(() => {
    if (!value) {
      setFormatted(emptyLabel);
      return;
    }

    setFormatted(formatValue(value, kind) ?? emptyLabel);
  }, [emptyLabel, kind, value]);

  return (
    <time dateTime={dateTimeValue} suppressHydrationWarning>
      {formatted}
    </time>
  );
}
