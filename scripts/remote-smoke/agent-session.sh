#!/usr/bin/env bash
# Source into an interactive agent shell (tmux, ssh) to export the provider
# key and set defaults that systemd normally handles via EnvironmentFile=.
#
# Usage (as the nestlone user):
#   . /opt/nestlone/nestlone/scripts/remote-smoke/agent-session.sh
#   nestlone models           # should list deepseek-v4-pro
#   gh auth status             # should show the fine-grained PAT
#
# The runtime.env file is 0640 root:nestlone, readable by the nestlone user.
set -a
# shellcheck disable=SC1091
. /etc/nestlone/runtime.env
set +a
export CODEWHALE_MODEL="${CODEWHALE_MODEL:-deepseek-v4-pro}"
