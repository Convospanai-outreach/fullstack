import { Tabs, TabsList, TabsTrigger, TabsContent } from "@craftmyfunnel/ui-sync";

export function Default() {
  return (
    <Tabs defaultValue="leads" style={{ width: 360 }}>
      <TabsList>
        <TabsTrigger value="leads">Leads</TabsTrigger>
        <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="leads">
        <p style={{ fontSize: 14 }}>1,204 leads imported this month.</p>
      </TabsContent>
      <TabsContent value="campaigns">
        <p style={{ fontSize: 14 }}>6 active campaigns running.</p>
      </TabsContent>
      <TabsContent value="settings">
        <p style={{ fontSize: 14 }}>Organization settings live here.</p>
      </TabsContent>
    </Tabs>
  );
}
