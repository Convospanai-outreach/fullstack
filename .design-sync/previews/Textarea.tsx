import { Textarea } from "@craftmyfunnel/ui-sync";

export function Default() {
  return <Textarea placeholder="Write a follow-up message..." style={{ width: 320 }} />;
}

export function Filled() {
  return (
    <Textarea
      style={{ width: 320 }}
      defaultValue={"Hi there — following up on our conversation last week about the pilot program."}
    />
  );
}

export function Disabled() {
  return <Textarea placeholder="Disabled" disabled style={{ width: 320 }} />;
}
