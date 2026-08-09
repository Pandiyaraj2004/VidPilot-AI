type ClassValue = string | number | null | undefined | false | Record<string, boolean | null | undefined> | ClassValue[];

/** Tiny classnames merger so components never string-concatenate conditional classes by hand. */
export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = [];

  for (const input of inputs) {
    if (!input) continue;

    if (typeof input === "string" || typeof input === "number") {
      classes.push(String(input));
      continue;
    }

    if (Array.isArray(input)) {
      const nested = cn(...input);
      if (nested) classes.push(nested);
      continue;
    }

    for (const key of Object.keys(input)) {
      if (input[key]) classes.push(key);
    }
  }

  return classes.join(" ");
}
