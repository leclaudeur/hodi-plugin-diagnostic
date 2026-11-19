// "412 Ko", "5,8 Mo", "1,5 Go", in the language shown, counted in thousands as Hodi shows sizes.
export const sizeText = (
  bytes: number,
  language: string,
  t: (key: string, options?: Record<string, unknown>) => string
) => {
  const number = (value: number, digits: number) =>
    new Intl.NumberFormat(language, { maximumFractionDigits: digits }).format(value)
  if (bytes < 1_000_000) return t('size.kb', { value: number(Math.max(1, Math.round(bytes / 1000)), 0) })
  if (bytes < 1_000_000_000) return t('size.mb', { value: number(bytes / 1_000_000, 1) })
  return t('size.gb', { value: number(bytes / 1_000_000_000, 2) })
}

// The issues of a report as the list says them: "Texte coupé, éléments en trop".
export const issuesText = (issues: readonly string[], t: (key: string, options?: Record<string, unknown>) => string) =>
  issues
    .map((issue, at) => {
      const label = t(`issues.${issue}`)
      return at === 0 ? label : label.charAt(0).toLowerCase() + label.slice(1)
    })
    .join(', ')
