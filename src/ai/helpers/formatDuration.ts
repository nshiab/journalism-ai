export default function formatDuration(milliseconds: number): string {
  if (milliseconds < 1_000) {
    return `${milliseconds} ms`;
  }
  return `${Math.round(milliseconds / 100) / 10} s`;
}
