#!/usr/bin/env bash
# Create (or reset) a sign-in user in the stack's Cognito user pool.
#
# Usage: ./scripts/create-user.sh <email> [stack-name]
# The password is read from $GENIE_USER_PASSWORD, or prompted for if unset.
# It is set as permanent, so the user is not forced to change it on first sign-in.
set -euo pipefail

EMAIL="${1:?usage: $0 <email> [stack-name]}"
STACK_NAME="${2:-GenAIChatBotStack}"

USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?starts_with(OutputKey, 'AuthenticationUserPoolId')].OutputValue | [0]" \
  --output text)

if [[ -z "$USER_POOL_ID" || "$USER_POOL_ID" == "None" ]]; then
  echo "Could not find the user pool output on stack $STACK_NAME. Is it deployed in this region?" >&2
  exit 1
fi

PASSWORD="${GENIE_USER_PASSWORD:-}"
if [[ -z "$PASSWORD" ]]; then
  read -r -s -p "Password for $EMAIL (min 8 chars, upper, lower, digit, symbol): " PASSWORD
  echo
fi

if aws cognito-idp admin-get-user --user-pool-id "$USER_POOL_ID" --username "$EMAIL" >/dev/null 2>&1; then
  echo "User exists, resetting password."
else
  aws cognito-idp admin-create-user \
    --user-pool-id "$USER_POOL_ID" \
    --username "$EMAIL" \
    --user-attributes Name=email,Value="$EMAIL" Name=email_verified,Value=true \
    --message-action SUPPRESS >/dev/null
fi

aws cognito-idp admin-set-user-password \
  --user-pool-id "$USER_POOL_ID" \
  --username "$EMAIL" \
  --password "$PASSWORD" \
  --permanent

echo "Ready: $EMAIL can sign in."
