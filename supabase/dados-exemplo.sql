-- ============================================================
-- MODO DEMONSTRAÇÃO: dados 100% fictícios, todos com "(exemplo)" no nome.
-- O jeito fácil é o botão em Configurações → Dados de exemplo (carregar e apagar).
-- Este arquivo faz o mesmo pelo SQL Editor, depois que o seu primeiro usuário existir.
-- ============================================================
select public._dados_exemplo((select id from household order by criado_em limit 1));

-- ============================================================
-- APAGAR DADOS DE EXEMPLO (rode só esta linha quando quiser limpar)
-- ============================================================
-- select public._apagar_dados_exemplo((select id from household order by criado_em limit 1));
