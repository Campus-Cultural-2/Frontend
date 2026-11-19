// Regras de validacao de usuario usadas em mais de uma tela.
//
// Ficam no app para dar retorno rapido ao usuario. A API confere de novo por
// conta propria: validacao no app ajuda quem preenche, mas nao substitui a do
// backend.

export function isInstitutionalEmail(value: string) {
  return /^[a-z0-9._%+\-]+@(alunos\.)?utfpr\.edu\.br$/i.test(value.trim());
}

export function getPasswordError(value: string) {
  if (value.length < 8) {
    return 'A senha deve ter pelo menos 8 caracteres';
  }

  if (!/[0-9]/.test(value)) {
    return 'A senha deve conter pelo menos um número';
  }

  if (!/[^A-Za-z0-9]/.test(value)) {
    return 'A senha deve conter pelo menos um caractere especial';
  }

  return null;
}
