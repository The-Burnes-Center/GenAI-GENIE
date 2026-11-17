#!/usr/bin/env bash
# Create (or reset) a sign-in user in the stack's Cognito user pool.
#
# Usage: ./scripts/create-user.sh <email> [--admin] [stack-name]
# The password is read from $GENIE_USER_PASSWORD, or prompted for if unset.
# It is set as permanent, so the user is not forced to change it on first sign-in.
# --admin adds the user to the "admin" group (use it for the first admin).
set -euo pipefail

EMAIL="${1:?usage: $0 <email> [--admin] [stack-name]}"
shift
IS_ADMIN=false
STACK_NAME="genie-dev"
for arg in "$@"; do
  case "$arg" in
    --admin) IS_ADMIN=true ;;
    *) STACK_NAME="$arg" ;;
  esac
done

USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?starts_with(OutputKey, 'UserPoolId') || starts_with(OutputKey, 'AuthenticationUserPoolId')].OutputValue | [0]" \
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

# Mark the account active so it skips the sign-up approval queue.
TABLE_NAME=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='TableName'].OutputValue | [0]" \
  --output text)
USER_SUB=$(aws cognito-idp admin-get-user \
  --user-pool-id "$USER_POOL_ID" \
  --username "$EMAIL" \
  --query "UserAttributes[?Name=='sub'].Value | [0]" \
  --output text)
if [[ -n "$TABLE_NAME" && "$TABLE_NAME" != "None" ]]; then
  NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  aws dynamodb update-item \
    --table-name "$TABLE_NAME" \
    --key "{\"PK\":{\"S\":\"USER#$USER_SUB\"},\"SK\":{\"S\":\"PROFILE\"}}" \
    --update-expression "SET #status = :active, email = :email, createdAt = if_not_exists(createdAt, :now)" \
    --expression-attribute-names '{"#status":"status"}' \
    --expression-attribute-values "{\":active\":{\"S\":\"active\"},\":email\":{\"S\":\"$EMAIL\"},\":now\":{\"S\":\"$NOW\"}}" >/dev/null
fi

if [[ "$IS_ADMIN" == true ]]; then
  aws cognito-idp admin-add-user-to-group \
    --user-pool-id "$USER_POOL_ID" \
    --username "$EMAIL" \
    --group-name admin
  echo "Ready: $EMAIL can sign in as an admin."
else
  echo "Ready: $EMAIL can sign in."
fi
