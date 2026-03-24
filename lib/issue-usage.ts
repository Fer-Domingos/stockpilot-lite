export const issueUsedForOptions = [
  "CNC Cutting",
  "Cabinet Production",
  "Installation",
  "Adjustment",
  "Damaged / Waste",
  "Other",
] as const;

export type IssueUsedFor = (typeof issueUsedForOptions)[number];

export function isIssueUsedFor(value: string): value is IssueUsedFor {
  return issueUsedForOptions.includes(value as IssueUsedFor);
}
