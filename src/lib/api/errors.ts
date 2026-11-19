export class AuthSessionError extends Error {
  constructor(message = 'Sessão expirada. Faça login novamente.') {
    super(message);
    this.name = 'AuthSessionError';
  }
}

export function isAuthSessionError(error: unknown): error is AuthSessionError {
  return error instanceof AuthSessionError;
}

// Erro devolvido pela API no formato { code, message, details }.
export class ApiError extends Error {
  code: string;
  details?: Record<string, unknown>;
  status: number;

  constructor(
    message: string,
    options: { code: string; details?: Record<string, unknown>; status: number },
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = options.code;
    this.details = options.details;
    this.status = options.status;
  }
}

type ApiErrorBody = { code?: unknown; details?: unknown; message?: unknown };

export function parseApiErrorBody(text: string): ApiErrorBody | null {
  try {
    const body = JSON.parse(text) as unknown;

    return body && typeof body === 'object' ? (body as ApiErrorBody) : null;
  } catch {
    return null;
  }
}

// Mensagem em portugues para cada codigo de erro da API. Nulo = sem texto proprio.
export function getFriendlyApiMessage(
  code: string,
  path: string,
  details?: Record<string, unknown>,
): string | null {
  switch (code) {
    case 'attendance_window_closed':
      return details?.reason === 'ended'
        ? 'Este evento já foi encerrado. Não é mais possível confirmar presença.'
        : 'O evento ainda não começou. A confirmação de presença abre no horário de início.';
    case 'invalid_password_reset_code':
      return 'Código inválido ou expirado. Confira o e-mail ou peça um novo código.';
    case 'invalid_attendance_code':
      return 'Código inválido. Confira se o QR code é deste evento e tente novamente.';
    case 'attendance_mode_mismatch':
      return 'Este evento não usa esse tipo de confirmação de presença.';
    case 'event_subscription_not_found':
      return path.endsWith('/attendance/check-in') || path.endsWith('/subscription')
        ? 'Você não está inscrito neste evento.'
        : 'Este aluno não está inscrito neste evento.';
    case 'event_already_subscribed':
      return 'Você já está inscrito neste evento.';
    case 'event_full':
      return 'Este evento atingiu o limite de participantes.';
    case 'event_limit_below_subscribers':
      return 'O limite de participantes não pode ser menor que o número de inscritos.';
    case 'invalid_event_period':
      return 'O encerramento precisa ser depois do início do evento.';
    case 'invalid_certificate_info':
      return 'Eventos com certificado precisam de carga horária e grupo de horas.';
    case 'invalid_image':
      return 'A imagem escolhida não é válida. Escolha outra.';
    case 'image_storage_unavailable':
      return 'Não foi possível salvar a imagem agora. Salve o evento sem banner ou tente mais tarde.';
    case 'permission_denied':
      return /\/events\/\d+\/subscribers$/.test(path)
        ? 'Somente o professor que organizou este evento ou um administrador pode consultar os participantes.'
        :  'Você não tem permissão para fazer isso.';
    default:
      return null;
  }
}
