// Agenda form.reset() pro próximo tick, depois que o React já capturou o
// FormData da submissão — chamar reset() direto dentro do handler de submit
// apagaria os campos ANTES do FormData ser lido, enviando tudo vazio.
export function agendarReset(form: HTMLFormElement | null) {
  if (!form) return
  setTimeout(() => form.reset(), 0)
}
