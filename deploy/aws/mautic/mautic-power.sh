#!/usr/bin/env bash
# Start, stop or check the Mautic instance. While AutoStopWhenIdle=true, the
# stack stops the instance after an hour without traffic; start it here.
#
#   bash deploy/aws/mautic/mautic-power.sh start|stop|status
#
# Uses your AWS CLI sign-in (AWS_PROFILE), stack STACK (default mautic) in
# AWS_REGION (default eu-north-1).
set -euo pipefail

STACK=${STACK:-mautic}
export AWS_REGION=${AWS_REGION:-eu-north-1}
AWS=${AWS_CLI:-aws}
if ! command -v "$AWS" >/dev/null 2>&1; then
  # Git Bash on Windows: the CLI's default install folder isn't on PATH.
  AWS="${LOCALAPPDATA:-}/Programs/Amazon/AWSCLIV2/aws.exe"
fi

resource() {
  "$AWS" cloudformation describe-stack-resource --stack-name "$STACK" --logical-resource-id "$1" \
    --query StackResourceDetail.PhysicalResourceId --output text
}
INSTANCE=$(resource Instance)
# Empty only when the stack has no IdleStopAlarm (AutoStopWhenIdle=false);
# any other failure stops the script.
ALARM=$("$AWS" cloudformation describe-stack-resources --stack-name "$STACK" \
  --query "StackResources[?LogicalResourceId=='IdleStopAlarm'].PhysicalResourceId" --output text)
if [ "$ALARM" = "None" ]; then ALARM=""; fi

state() {
  "$AWS" ec2 describe-instances --instance-ids "$INSTANCE" \
    --query 'Reservations[0].Instances[0].State.Name' --output text
}

case "${1:-status}" in
  start)
    "$AWS" ec2 start-instances --instance-ids "$INSTANCE" >/dev/null
    "$AWS" ec2 wait instance-running --instance-ids "$INSTANCE"
    # Restart the idle hour. An alarm still in ALARM from before the stop
    # would otherwise never transition again, and never stop the instance.
    if [ -n "$ALARM" ]; then
      "$AWS" cloudwatch set-alarm-state --alarm-name "$ALARM" --state-value OK \
        --state-reason "Started by mautic-power.sh"
    fi
    echo "$INSTANCE is running. Mautic answers in about 2 minutes, once its containers are up."
    ;;
  stop)
    "$AWS" ec2 stop-instances --instance-ids "$INSTANCE" >/dev/null
    "$AWS" ec2 wait instance-stopped --instance-ids "$INSTANCE"
    echo "$INSTANCE is stopped."
    ;;
  status)
    echo "$INSTANCE: $(state)"
    if [ -n "$ALARM" ]; then
      echo "Idle auto-stop: on (alarm $("$AWS" cloudwatch describe-alarms --alarm-names "$ALARM" \
        --query 'MetricAlarms[0].StateValue' --output text))"
    else
      echo "Idle auto-stop: off"
    fi
    ;;
  *)
    echo "usage: $0 start|stop|status" >&2
    exit 2
    ;;
esac
