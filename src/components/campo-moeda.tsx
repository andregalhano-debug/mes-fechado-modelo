'use client'

import { useEffect, useRef, useState } from 'react'

function formatarDigitos(digitos: string): string {
  const semZerosExtra = digitos.replace(/^0+(?=\d)/, '')
  const numero = semZerosExtra ? parseInt(semZerosExtra, 10) : 0
  const comCentavos = (numero / 100).toFixed(2)
  const [inteiro, decimal] = comCentavos.split('.')
  const comMilhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${comMilhar},${decimal}`
}

function valorInicial(defaultValue: Props['defaultValue']): string {
  const numero = Number(defaultValue ?? 0)
  if (!numero) return ''
  return formatarDigitos(Math.round(numero * 100).toString())
}

type Props = Omit<React.ComponentPropsWithoutRef<'input'>, 'type' | 'defaultValue' | 'inputMode'> & {
  defaultValue?: number | string | null
}

// Input de moeda com máscara ao vivo no padrão BR: milhar com ponto, decimal
// com vírgula (ex: 54.000,90). O texto digitado é sempre tratado como
// centavos, então a formatação nunca fica inconsistente no meio da digitação.
export function CampoMoeda({ defaultValue, ...props }: Props) {
  const [valor, setValor] = useState(() => valorInicial(defaultValue))
  const ref = useRef<HTMLInputElement>(null)
  // Sempre o valor salvo mais recente vindo do servidor (não o do primeiro render).
  const valorSalvo = useRef(defaultValue)

  // Quando o servidor devolve um novo valor salvo (ex: depois de "Salvar" no patrimônio),
  // o campo passa a mostrar esse valor.
  useEffect(() => {
    valorSalvo.current = defaultValue
    setValor(valorInicial(defaultValue))
  }, [defaultValue])

  // form.reset() nativo não sabe mexer em state do React — sem isso, um reset (ex:
  // formulário de criação limpando após enviar) não afetaria esse campo. O React também
  // reseta o formulário sozinho depois de uma action; aqui o reset volta pro valor salvo
  // MAIS RECENTE — antes voltava pro valor de quando a página abriu (ex: o copiado do mês
  // anterior), parecendo que o que foi digitado não tinha sido salvo.
  useEffect(() => {
    const form = ref.current?.form
    if (!form) return
    function aoResetar() {
      setValor(valorInicial(valorSalvo.current))
    }
    form.addEventListener('reset', aoResetar)
    return () => form.removeEventListener('reset', aoResetar)
  }, [])

  return (
    <input
      ref={ref}
      type="text"
      inputMode="decimal"
      value={valor}
      onChange={(e) => {
        const digitos = e.target.value.replace(/\D/g, '')
        setValor(digitos ? formatarDigitos(digitos) : '')
      }}
      {...props}
    />
  )
}
