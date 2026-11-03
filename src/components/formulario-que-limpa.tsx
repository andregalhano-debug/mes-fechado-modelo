'use client'

import { useRef } from 'react'
import { agendarReset } from './form-reset'

type Props = Omit<React.ComponentPropsWithoutRef<'form'>, 'action'> & {
  action: (formData: FormData) => void | Promise<void>
}

// Formulário de criação simples (sem rascunho) que volta vazio depois de
// enviar — sem isso, inputs não-controlados mantêm o que foi digitado
// mesmo após o Server Action completar, porque defaultValue só se aplica
// na primeira montagem.
export function FormularioQueLimpa({ action, children, ...props }: Props) {
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={() => agendarReset(formRef.current)}
      {...props}
    >
      {children}
    </form>
  )
}
