// "412 Ko", "5,8 Mo", in the language shown.
export const sizeText = (
  bytes: number,
  language: string,
  t: (key: string, options?: Record<string, unknown>) => string
) => {
  const number = (value: number, digits: number) =>
    new Intl.NumberFormat(language, { maximumFractionDigits: digits }).format(value)
  return bytes < 1024 * 1024
    ? t('size.kb', { value: number(Math.max(1, Math.round(bytes / 1024)), 0) })
    : t('size.mb', { value: number(bytes / (1024 * 1024), 1) })
}

// The issues of a report as the list says them: "Texte coupé, éléments en trop", "Autre : la date est fausse".
export const issuesText = (
  issues: readonly string[],
  t: (key: string, options?: Record<string, unknown>) => string,
  other?: string | null
) =>
  issues
    .map((issue, at) => {
      const label = issue === 'other' && other ? t('issues.otherSaid', { text: other }) : t(`issues.${issue}`)
      return at === 0 ? label : label.charAt(0).toLowerCase() + label.slice(1)
    })
    .join(', ')
