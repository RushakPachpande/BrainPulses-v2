export type StatusTone = 'ok' | 'wn' | 'er' | 'gy' | '';

export function statusTone(value: string): StatusTone {
  if (value === 'Yes' || /Active|Completed|Assigned|Enabled|Published|Healthy|Passed/.test(value))
    return 'ok';
  if (value === 'Per access' || /Draft|Pending|In Progress|Not Started|Invited/.test(value))
    return 'wn';
  if (value === 'No' || /Inactive|Failed|Disabled|Absent/.test(value)) return 'er';
  if (/^Admin$/.test(value)) return 'gy';
  return '';
}
