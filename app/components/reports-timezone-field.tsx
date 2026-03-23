"use client";

import { useEffect, useState } from "react";

type ReportsTimezoneFieldProps = {
  initialValue?: string;
};

export function ReportsTimezoneField({
  initialValue,
}: ReportsTimezoneFieldProps) {
  const [value, setValue] = useState(initialValue ?? "");

  useEffect(() => {
    setValue(String(new Date().getTimezoneOffset()));
  }, []);

  return (
    <input type="hidden" name="timeZoneOffsetMinutes" value={value} readOnly />
  );
}
