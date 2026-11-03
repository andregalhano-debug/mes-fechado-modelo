// Olho de "ocultar valores" em todo o sistema. Roda no <head>, antes da primeira pintura:
// aplica a preferência salva (classe valores-ocultos no <html>) e observa o DOM marcando com
// data-valor todo elemento cujo texto tenha um valor em reais (R$ 1.234,56 · 1.234 · 12,50).
// O CSS borra só esses elementos quando o olho está fechado — sem mexer nos componentes.
export const CHAVE_OCULTAR = 'financas:ocultar-valores'

export const SCRIPT_MASCARA = String.raw`(function(){
var RE=/R\$\s?-?\d|\d{1,3}(\.\d{3})+(,\d{2})?|\d+,\d{2}(?!\d)/;
var h=document.documentElement;
try{if(localStorage.getItem('${CHAVE_OCULTAR}')==='1')h.classList.add('valores-ocultos')}catch(e){}
function txt(t){var p=t.parentElement;if(p&&p.tagName!=='SCRIPT'&&p.tagName!=='STYLE'&&p.tagName!=='TITLE'&&RE.test(t.data))p.setAttribute('data-valor','')}
function marcar(n){if(n.nodeType===3)return txt(n);if(n.nodeType!==1||n.tagName==='SCRIPT'||n.tagName==='STYLE')return;var w=document.createTreeWalker(n,4),t;while((t=w.nextNode()))txt(t)}
new MutationObserver(function(ms){for(var i=0;i<ms.length;i++){var m=ms[i];if(m.type==='characterData')txt(m.target);else for(var j=0;j<m.addedNodes.length;j++)marcar(m.addedNodes[j])}}).observe(h,{childList:true,subtree:true,characterData:true});
})();`
