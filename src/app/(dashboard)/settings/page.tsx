"use client";

import { ApiKeyForm } from "@/components/settings/api-key-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Note: metadata cannot be exported from client components in Next.js 15.
// The title is set via the layout or a separate server component wrapper if needed.

export default function SettingsPage() {
  return (
    <div className="max-w-2xl" data-testid="settings-page">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your account and preferences
        </p>
      </div>

      <Tabs defaultValue="api-key">
        <TabsList>
          <TabsTrigger value="api-key" data-testid="settings-tab-api-key">
            API Key
          </TabsTrigger>
          <TabsTrigger value="profile" data-testid="settings-tab-profile">
            Profile
          </TabsTrigger>
        </TabsList>

        <TabsContent value="api-key" className="mt-4">
          <ApiKeyForm />
        </TabsContent>

        <TabsContent value="profile" className="mt-4">
          <ProfileForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
