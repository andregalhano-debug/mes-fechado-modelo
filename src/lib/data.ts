// Formata uma data (coluna `date`, sem hora) sem sofrer o deslocamento de
// fuso horário de `new Date('2026-08-12')`, que o navegador/servidor lê como
// meia-noite UTC e pode exibir um dia antes em fusos negativos (ex: Brasil).
export function formatarData(data: string): string {
  const [ano, mes, dia] = data.slice(0, 10).split('-').map(Number)
  return new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR')
}
