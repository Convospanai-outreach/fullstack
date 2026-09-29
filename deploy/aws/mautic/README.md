# Mautic on AWS

`mautic.yaml` is a CloudFormation stack that runs Mautic on a single EC2 instance. `apps/api` pushes captured leads to it (`src/modules/mautic-integration/service/mauticService.ts`). Mautic doesn't send nurture email for leads that are already in the app's own sequence pipeline.

```
visitor / apps/api ──HTTPS──> Cloudflare (proxied, Full strict)
                                   │ 443, Cloudflare IPs only (security group)
                                   ▼
EC2 t4g.small (AL2023, Docker Compose)
  caddy (origin cert) ─> mautic_web ─┐
  mautic_cron, mautic_worker ────────┼─> mysql 8.4
  /srv/mautic = separate encrypted EBS volume, daily snapshots kept 7 days
```

- **Admin access:** only through SSM Session Manager. There's no SSH, no key pair, and port 22 is closed.
- **Configuration:** cfn-init writes the files on the instance to `/opt/mautic`:
  - `compose.yaml`
  - `Caddyfile`
  - `host-setup.sh`
  - `bootstrap.sh`
- **Secrets:** the instance reads them from Secrets Manager with its own role at runtime. Nothing secret is in the template, its parameters or the user data.
  - `AdminSecret`: the generated Mautic admin password.
  - `ExternalSecret`: values you fill in yourself (the Resend API key and the Cloudflare origin certificate and key).
  - The database passwords are generated on first boot and stored on the data volume, next to the database.
- **Proxy trust:** Caddy trusts Cloudflare's ranges to report the client IP. Mautic trusts only the compose network (`172.28.0.0/24`), meaning Caddy. It never trusts `0.0.0.0/0`.

## Before you deploy

1. **Activate the account.** Run `aws ec2 describe-vpcs` in the target Region. It must work, not return `OptInRequired`.
2. **Use an IAM admin user or IAM Identity Center, not the root user.**
3. **Confirm the instance type is allowed.** Free plan accounts can launch only free-tier-eligible types. Check that the output lists `t4g.small`:
   ```sh
   aws ec2 describe-instance-types --filters Name=free-tier-eligible,Values=true \
     --query 'InstanceTypes[].InstanceType'
   ```
4. **Resend:** create a new API key with **sending access** only, restricted to the verified domain. Use a key just for Mautic, so you can revoke it without touching the apps' key. `MailerFromEmail` must be on that verified domain.
5. **Cloudflare Origin Certificate:** in the dashboard, go to SSL/TLS → Origin Server → Create Certificate, with hostname `mautic.craftmyfunnel.live`. Keep the certificate and private key for step 1 of "After the stack is up".

## Deploy

```sh
AMI=$(aws ssm get-parameter --region eu-north-1 \
  --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64 \
  --query Parameter.Value --output text)

aws cloudformation deploy --region eu-north-1 --stack-name mautic \
  --template-file deploy/aws/mautic/mautic.yaml --capabilities CAPABILITY_IAM \
  --parameter-overrides ImageId="$AMI" AdminEmail=<you> AlertEmail=<you> MailerFromEmail=<sender>
```

Stack creation waits up to 25 minutes, until first boot has installed Mautic. After that, Mautic runs but can't be reached yet: Caddy stays stopped until the origin certificate is in place.

The AMI is a parameter on purpose. A new AMI replaces the instance, and that replacement fails while the data volume is still attached to the old instance. So patch in place instead (`sudo dnf upgrade`), and change `ImageId` only as a planned move.

## After the stack is up

1. **Fill in `ExternalSecret`** (the `ExternalSecretArn` output). Its keys are `resend_api_key`, `cloudflare_origin_cert` and `cloudflare_origin_key`. Use the console's key/value editor, or:
   ```sh
   jq -n --arg resend "$RESEND_KEY" --rawfile cert origin.pem --rawfile key origin.key \
     '{resend_api_key: $resend, cloudflare_origin_cert: $cert, cloudflare_origin_key: $key}' > external.json
   aws secretsmanager put-secret-value --secret-id <ExternalSecretArn> --secret-string file://external.json
   rm external.json
   ```
   Then apply it:
   ```sh
   aws ssm send-command --document-name AWS-RunShellScript --targets Key=InstanceIds,Values=<InstanceId> \
     --parameters commands=/opt/mautic/bootstrap.sh
   ```
2. **Set up Cloudflare** for `craftmyfunnel.live`:
   - Add an `A` record for `mautic` pointing to the `OriginIp` output, **proxied**.
   - Add a **Configuration Rule** with the condition "Hostname equals `mautic.craftmyfunnel.live`" and the setting SSL = **Full (strict)**.
   - Don't change the zone-wide SSL mode. It's **Full** and also covers the web app and the API.
3. **Log in** at `https://mautic.craftmyfunnel.live` as `admin`, with the password from `AdminSecret`.
   - Settings → Configuration shows the API and Basic auth as enabled, and the mailer as Resend. `bootstrap.sh` sets these through `MAUTIC_CONFIG_PARAMETERS`, which overrides edits made in the UI.
   - Send a test email from the Email Settings tab.
4. **Create an API user for `apps/api`:**
   - Create a role that can only view, create and edit contacts.
   - Create a user with that role.
   - On both Oracle VMs (api-main and api-worker), set `MAUTIC_BASE_URL=https://mautic.craftmyfunnel.live`, plus `MAUTIC_USERNAME` and `MAUTIC_PASSWORD`, in the compose `.env`. Then recreate the containers.
   - Check that Cloudflare's bot protection doesn't challenge these server-to-server calls.

## Verify

- `curl -sI https://mautic.craftmyfunnel.live/s/login` returns `200`.
- `curl -k --connect-timeout 5 https://<OriginIp>/` times out, because only Cloudflare can connect.
- Submit a lead through a landing page. The contact appears in Mautic with the team tag.

## Operate

- **Shell:** `aws ssm start-session --target <InstanceId>`. The stack lives in `/opt/mautic` and its data in `/srv/mautic`. Use `sudo docker compose -f /opt/mautic/compose.yaml ps` and `… logs mautic_web`.
- **Re-apply configuration after a template change:** `sudo /opt/aws/bin/cfn-init -v --stack mautic --resource Instance --region eu-north-1`. It re-runs both scripts, which are idempotent. Image tags live in `compose.yaml` inside the template. The web container runs Mautic's database migrations when it starts.
- **Backups:** Data Lifecycle Manager snapshots the data volume daily at 02:00 UTC and keeps 7 snapshots. To restore:
  1. Create a volume from a snapshot in the same Availability Zone.
  2. Stop the instance and swap the volume in.
- **Cloudflare ranges:** if https://www.cloudflare.com/ips-v4 changes, update both the security group and the `Caddyfile` in the template. `scripts/ci/mautic-template.test.mjs` checks that they match.
- **Cost:** roughly $18–20 a month, charged against the Free plan credits:
  - instance about $12;
  - public IPv4 address $3.60;
  - EBS about $2;
  - snapshots and secrets about $1.

  Check these against the AWS Pricing Calculator. The `CostBudget` alert fires at 80% of `MonthlyBudgetUsd`, measured before credits.
