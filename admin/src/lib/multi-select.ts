/** Empty selection means every option. A partial selection matches any chosen value. */
export function selectionMatches(selected: string[], value: string) {
  return selected.length === 0 || selected.includes(value);
}
