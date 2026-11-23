/** Static face aliases avoid synthetic bold and Android variable-font differences. */
export const scheduleFonts = {
  regular: 'SchedulePretendard-Regular',
  medium: 'SchedulePretendard-Medium',
  semibold: 'SchedulePretendard-SemiBold',
  bold: 'SchedulePretendard-Bold',
} as const;
export function scheduleFace(weight: string | number | undefined): string {
  if (weight === 'bold' || Number(weight) >= 700) return scheduleFonts.bold;
  if (Number(weight) >= 600) return scheduleFonts.semibold;
  if (Number(weight) >= 500) return scheduleFonts.medium;
  return scheduleFonts.regular;
}
