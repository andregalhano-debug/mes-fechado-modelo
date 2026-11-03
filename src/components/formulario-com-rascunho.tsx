'use client'

import { useEffect, useRef } from 'react'
import { agendarReset } from './form-reset'

type Campo = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

type Props = Omit<React.ComponentPropsWithoutRef<'form'>, 'action'> & {
  chave: string
  action: (formData: FormData) => void | Promise<void>
}

function campos(form: HTMLFormElement): Campo[] {
  return Array.from(form.elements).filter(
    (el): el is Campo =>
      el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement,
  )
}

// Componentes controlados (ex: CampoMoeda) só percebem uma mudança de valor
// vinda de fora do React se ela passar pelo setter nativo + um evento real —
// atribuir "el.value = x" direto não dispara o onChange do React.
function protoDoElemento(el: Campo) {
  if (el instanceof HTMLTextAreaElement) return window.HTMLTextAreaElement.prototype
  if (el instanceof HTMLSelectElement) return window.HTMLSelectElement.prototype
  return window.HTMLInputElement.prototype
}

function definirValor(el: Campo, valor: string) {
  const setter = Object.getOwnPropertyDescriptor(protoDoElemento(el), 'value')?.set
  if (setter) setter.call(el, valor)
  else el.value = valor
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

function definirChecked(el: HTMLInputElement, checked: boolean) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'checked')?.set
  if (setter) setter.call(el, checked)
  else el.checked = checked
  el.dispatchEvent(new Event('click', { bubbles: true }))
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

// Envolve um <form> com auto-save de rascunho no localStorage, pra não perder
// o que a pessoa estava digitando se fechar a aba ou sair sem enviar.
export function FormularioComRascunho({ chave, action, children, ...props }: Props) {
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const form = formRef.current
    if (!form) return

    const salvo = localStorage.getItem(chave)
    if (salvo) {
      try {
        const dados = JSON.parse(salvo) as Record<string, string>
        for (const el of campos(form)) {
          if (!el.name || !(el.name in dados)) continue
          if (el.type === 'checkbox' || el.type === 'radio') {
            definirChecked(el as HTMLInputElement, dados[el.name] === el.value)
          } else {
            definirValor(el, dados[el.name])
          }
        }
      } catch {
        localStorage.removeItem(chave)
      }
    }

    let timeout: ReturnType<typeof setTimeout>
    function salvar() {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        if (!form) return
        const dados: Record<string, string> = {}
        for (const el of campos(form)) {
          if (!el.name) continue
          if (el.type === 'checkbox' || el.type === 'radio') {
            if ((el as HTMLInputElement).checked) dados[el.name] = el.value
          } else if (el.value) {
            dados[el.name] = el.value
          }
        }
        if (Object.keys(dados).length === 0) {
          localStorage.removeItem(chave)
        } else {
          localStorage.setItem(chave, JSON.stringify(dados))
        }
      }, 400)
    }

    function limpar() {
      clearTimeout(timeout)
      localStorage.removeItem(chave)
      agendarReset(form)
    }

    form.addEventListener('input', salvar)
    form.addEventListener('submit', limpar)
    return () => {
      form.removeEventListener('input', salvar)
      form.removeEventListener('submit', limpar)
      clearTimeout(timeout)
    }
  }, [chave])

  return (
    <form ref={formRef} action={action} {...props}>
      {children}
    </form>
  )
}
