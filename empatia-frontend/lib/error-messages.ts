/**
 * Converte erros técnicos em mensagens amigáveis para idosos
 */
export function getFriendlyErrorMessage(error: unknown): string {
  const errorStr = String(error).toLowerCase();

  // Permissão de microfone
  if (
    errorStr.includes('notallowederror') ||
    errorStr.includes('permission denied') ||
    errorStr.includes('permissão negada')
  ) {
    return 'O EmpatIA precisa de aceder ao seu microfone. Por favor, clique em "Permitir" quando o navegador perguntar.';
  }

  // Microfone não encontrado
  if (errorStr.includes('notfounderror') || errorStr.includes('device not found')) {
    return 'Não conseguimos encontrar o seu microfone. Verifique se tem um ligado ao computador ou telemóvel.';
  }

  // Problemas de rede/conexão
  if (
    errorStr.includes('networkerror') ||
    errorStr.includes('failed to connect') ||
    errorStr.includes('connection failed') ||
    errorStr.includes('network')
  ) {
    return 'Parece que a internet está lenta. Vamos tentar novamente em alguns segundos.';
  }

  // Timeout
  if (errorStr.includes('timeout') || errorStr.includes('timed out')) {
    return 'A chamada demorou muito tempo. Quer tentar outra vez?';
  }

  // Erro de segurança (não HTTPS)
  if (errorStr.includes('security') || errorStr.includes('https')) {
    return 'Erro de Segurança: O microfone só funciona em páginas seguras. Verifique o URL da página.';
  }

  // Microfone ocupado
  if (errorStr.includes('in use') || errorStr.includes('busy')) {
    return 'O microfone está a ser usado por outra aplicação. Feche outras aplicações que usem o microfone e tente novamente.';
  }

  // Default amigável
  return 'Algo correu mal. Não se preocupe, vamos tentar resolver. Tente novamente dentro de momentos.';
}

/**
 * Mensagens de sucesso amigáveis
 */
export const successMessages = {
  connected: 'Ligado! Pode começar a falar.',
  reconnected: 'Reconectado! A continuar a conversa...',
  micEnabled: 'Microfone ligado',
  micDisabled: 'Microfone desligado',
};

/**
 * Instruções para diferentes plataformas
 */
export function getMicrophoneInstructions(): string {
  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes('mac')) {
    return 'No Mac: Vá a "Definições do Sistema" > "Segurança e Privacidade" > "Microfone" e permita o acesso ao navegador.';
  }

  if (userAgent.includes('windows')) {
    return 'No Windows: Vá a "Definições" > "Privacidade" > "Microfone" e permita o acesso ao navegador.';
  }

  if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
    return 'No iPhone/iPad: Vá a "Definições" > "Safari" > "Microfone" e permita o acesso.';
  }

  if (userAgent.includes('android')) {
    return 'No Android: Vá a "Definições" > "Apps" > "Chrome" > "Permissões" > "Microfone" e permita o acesso.';
  }

  return 'Verifique as definições de permissões do seu navegador para permitir acesso ao microfone.';
}
