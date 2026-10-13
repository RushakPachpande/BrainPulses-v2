import { useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAccessUsers, getPermissions } from "@/services";

export function AccessSettingsPage() {
  const [people, setPeople] = useState(() => getAccessUsers());
  const permissions = getPermissions();

  function toggle(index: number, key: "assessment" | "quiz" | "enabled") {
    setPeople((current) =>
      current.map((person, personIndex) =>
        personIndex === index ? { ...person, [key]: !person[key] } : person,
      ),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Admin users</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {people.map((user, index) => (
              <div key={user.email} className="flex flex-col gap-3">
                {index > 0 ? <Separator /> : null}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{user.name}</span>
                    <StatusBadge value={user.role} />
                  </div>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  {(["assessment", "quiz", "enabled"] as const).map((key) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      {key === "assessment" ? "Assessment" : key === "quiz" ? "Quiz" : "Enabled"}
                      <Switch
                        checked={user[key]}
                        onCheckedChange={() => toggle(index, key)}
                        aria-label={`${user.name} ${key}`}
                      />
                    </label>
                  ))}
                </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Roles</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <span>Super Admin</span>
              <StatusBadge value="Full control" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Admin</span>
              <StatusBadge value="Limited" />
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Permission</TableHead>
                  <TableHead scope="col">Super Admin</TableHead>
                  <TableHead scope="col">Admin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissions.map((item) => (
                  <TableRow key={item.name}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>
                      <StatusBadge value={item.superAdmin} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={item.admin} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
