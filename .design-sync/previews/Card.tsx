import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
} from "@craftmyfunnel/ui-sync";

export function Default() {
  return (
    <Card style={{ maxWidth: 360 }}>
      <CardHeader>
        <CardTitle>Weekly outreach report</CardTitle>
        <CardDescription>142 leads contacted, 38 replies</CardDescription>
      </CardHeader>
      <CardContent>
        <p style={{ fontSize: 14, color: "var(--muted-foreground)" }}>
          Reply rate is up 6% week over week across all active campaigns.
        </p>
      </CardContent>
      <CardFooter>
        <Button size="sm">View report</Button>
      </CardFooter>
    </Card>
  );
}

export function Simple() {
  return (
    <Card style={{ maxWidth: 320 }}>
      <CardContent>
        <p>A card with just body content, no header or footer.</p>
      </CardContent>
    </Card>
  );
}
