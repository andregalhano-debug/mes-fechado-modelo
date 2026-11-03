'use client'

type Props = Omit<React.ComponentPropsWithoutRef<'form'>, 'action' | 'onSubmit'> & {
  mensagem: string
  action: (formData: FormData) => void | Promise<void>
}

// Pede confirmação antes de enviar formulários que removem/desativam algo —
// evita clique acidental apagando lançamento, conta, meta etc.
export function FormularioComConfirmacao({ mensagem, action, children, ...props }: Props) {
  return (
    <form
      action={action}
      onSubmit={(evento) => {
        if (!window.confirm(mensagem)) evento.preventDefault()
      }}
      {...props}
    >
      {children}
    </form>
  )
}
