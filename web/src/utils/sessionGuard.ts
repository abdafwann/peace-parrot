export function isCurrentSession(requestToken: string | null, currentToken: string | null): boolean {
  return requestToken !== null && requestToken === currentToken
}
