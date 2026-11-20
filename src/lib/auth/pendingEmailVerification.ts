// Guarda, so na memoria do app, qual e-mail esta esperando confirmacao, para a
// tela do codigo ja abrir preenchida depois do cadastro ou de um login
// bloqueado.
//
// Nao vai como parametro de rota de proposito: no build web o parametro vira
// parte da URL (?email=...), e e-mail nao deve ficar em URL, historico do
// navegador e logs de servidor. Se o app recarregar, o valor se perde e a tela
// pede o e-mail de novo.
//
// Ler e limpar sao separados: em desenvolvimento o React roda o inicializador
// do useState duas vezes, e uma leitura que limpasse veria vazio na segunda.

let pendingEmail: string | null = null;

export function setPendingEmailVerification(email: string) {
  pendingEmail = email.trim();
}

export function getPendingEmailVerification() {
  return pendingEmail;
}

export function clearPendingEmailVerification() {
  pendingEmail = null;
}
