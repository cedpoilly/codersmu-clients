#!/usr/bin/env bash

set -euo pipefail

base_url="${CODERSMU_HOSTED_API_BASE_URL:-https://codersmu.lepopquiz.app}"
base_url="${base_url%/}"

user_agent="codersmu-hosted-api-check/0.1 (+https://coders.mu)"
timeout_seconds="${CODERSMU_HOSTED_API_TIMEOUT_SECONDS:-10}"

health_response="$(curl \
  --silent \
  --show-error \
  --fail \
  --location \
  --max-time "${timeout_seconds}" \
  --header "accept: application/json" \
  --header "user-agent: ${user_agent}" \
  "${base_url}/health")"

if [[ "${health_response}" != *'"ok":true'* ]]; then
  echo "Hosted API health check returned an unexpected payload from ${base_url}/health:" >&2
  echo "${health_response}" >&2
  exit 1
fi

next_response="$(curl \
  --silent \
  --show-error \
  --fail \
  --location \
  --max-time "${timeout_seconds}" \
  --header "accept: application/json" \
  --header "user-agent: ${user_agent}" \
  "${base_url}/meetups/next")"

if [[ "${next_response}" != *'"meetup"'* ]]; then
  echo "Hosted API next-meetup check returned an unexpected payload from ${base_url}/meetups/next:" >&2
  echo "${next_response}" >&2
  exit 1
fi

echo "Hosted API is healthy at ${base_url}"
