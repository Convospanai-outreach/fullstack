import { Input } from "@craftmyfunnel/ui-sync";

export function Default() {
  return (
    <div style={{ width: 320 }}>
      <Input label="Email address" placeholder="you@company.com" />
    </div>
  );
}

export function WithHint() {
  return (
    <div style={{ width: 320 }}>
      <Input label="Campaign name" hint="Visible only to your team" defaultValue="Q3 Outreach Push" />
    </div>
  );
}

export function WithError() {
  return (
    <div style={{ width: 320 }}>
      <Input label="Email address" defaultValue="not-an-email" error="Enter a valid email address" />
    </div>
  );
}
