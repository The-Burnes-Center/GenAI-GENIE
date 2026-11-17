const MESSAGES: Record<string, string> = {
  NotAuthorizedException: 'Email or password is incorrect.',
  UserNotFoundException: 'Email or password is incorrect.',
  PasswordResetRequiredException: 'Reset your password using "Forgot password".',
  UserNotConfirmedException: 'Confirm your email first. Check your inbox for the code.',
  InvalidPasswordException: 'That password does not meet the password policy.',
  CodeMismatchException: 'That code is not correct.',
  ExpiredCodeException: 'That code has expired. Request a new one.',
  UsernameExistsException: 'An account with this email already exists.',
  LimitExceededException: 'Too many attempts. Wait a few minutes and try again.',
  TooManyRequestsException: 'Too many attempts. Wait a few minutes and try again.',
  NotAuthorizedUserException: 'Your sign-in has timed out. Start again.',
  NotAllowedError: 'The passkey prompt was cancelled or timed out.',
}

const TRIGGER_PREFIX = /failed with error\s*/i

// Sign-up is refused by the pre sign-up Lambda. Its friendly message follows the Cognito prefix.
function triggerMessage(message: string): string | null {
  if (!TRIGGER_PREFIX.test(message)) return null
  // Cognito appends its own period after the trigger's message, so collapse "..".
  const text = message.replace(/^.*?failed with error\s*/i, '').trim().replace(/\.{2,}$/, '.')
  return text === '' ? null : text
}

// Maps Cognito and WebAuthn error names to text that does not reveal whether an account exists.
export function describeAuthError(error: unknown): string {
  const name = error instanceof Error ? error.name : ''
  if (name === 'UserLambdaValidationException' && error instanceof Error) {
    const friendly = triggerMessage(error.message)
    if (friendly) return friendly
  }
  const message = MESSAGES[name]
  if (message) return message
  console.error('Auth error', error)
  return 'Something went wrong. Try again.'
}

// Cognito rejects a disabled account with NotAuthorizedException: "User is disabled."
export function isUserDisabledError(error: unknown): boolean {
  return error instanceof Error && error.name === 'NotAuthorizedException' && /user is disabled/i.test(error.message)
}
