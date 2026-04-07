'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, RefreshCw, Save, RotateCcw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { adminFetch } from '@/lib/admin-api';

interface AgentSchedule {
  name: string;
  model: string;
  schedule: string;
  description: string;
  enabled: boolean;
  nextRun?: string;
}

interface ScheduleData {
  schedule: AgentSchedule[];
  lastUpdated: string;
}

export default function AgentSchedulePage() {
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editedSchedule, setEditedSchedule] = useState<AgentSchedule[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [offline, setOffline] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);

  useEffect(() => {
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    try {
      setIsLoading(true);
      setOffline(false);
      const response = await adminFetch('/api/agent/schedule');

      if (response.status === 503) {
        setOffline(true);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch schedule');
      }

      const data = await response.json();
      setScheduleData(data);
      setEditedSchedule(data.schedule);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to fetch schedule:', error);
      setOffline(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScheduleChange = (index: number, field: keyof AgentSchedule, value: string | boolean) => {
    const updated = [...editedSchedule];
    updated[index] = { ...updated[index], [field]: value };
    setEditedSchedule(updated);
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      const response = await adminFetch('/api/agent/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule: editedSchedule }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save schedule');
      }

      const data = await response.json();
      setScheduleData(data);
      setEditedSchedule(data.schedule);
      setHasChanges(false);

      toast.success('Schedule updated successfully');
    } catch (error) {
      console.error('Failed to save schedule:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save schedule');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      setIsSaving(true);
      setShowResetDialog(false);

      const response = await adminFetch('/api/agent/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });

      if (!response.ok) {
        throw new Error('Failed to reset schedule');
      }

      const data = await response.json();
      setScheduleData(data);
      setEditedSchedule(data.schedule);
      setHasChanges(false);

      toast.success('Schedule reset to defaults');
    } catch (error) {
      console.error('Failed to reset schedule:', error);
      toast.error('Failed to reset schedule');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (offline) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-6xl">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <span>Admin</span>
          <span>&gt;</span>
          <span>Agent Monitor</span>
          <span>&gt;</span>
          <span className="text-foreground">Schedule</span>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <WifiOff className="h-12 w-12 text-muted-foreground mb-4" />
            <Badge variant="outline" className="bg-destructive/10 text-destructive mb-4">
              PodClaw Offline
            </Badge>
            <p className="text-lg font-medium">PodClaw bridge is not reachable</p>
            <p className="text-sm text-muted-foreground mt-1">
              Start PodClaw to view and edit the agent schedule
            </p>
            <Button onClick={fetchSchedule} variant="outline" className="mt-4">
              Retry Connection
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!scheduleData) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        Failed to load schedule
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <span>Admin</span>
        <span>&gt;</span>
        <span>Agent Monitor</span>
        <span>&gt;</span>
        <span className="text-foreground">Schedule</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Calendar className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Agent Schedule</h1>
        </div>
        <p className="text-muted-foreground">
          Configure PodClaw autonomous agent execution schedule
        </p>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-sm text-muted-foreground">
          Last updated: {new Date(scheduleData.lastUpdated).toLocaleString()}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowResetDialog(true)}
            disabled={isSaving}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Default
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Schedule Grid */}
      <div className="space-y-4">
        {editedSchedule.map((agent, index) => (
          <Card key={agent.name}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-lg capitalize">
                    {agent.name.replace('_', ' ')}
                  </CardTitle>
                  <Badge variant="outline">{agent.model}</Badge>
                  <Switch
                    checked={agent.enabled}
                    onCheckedChange={(checked) =>
                      handleScheduleChange(index, 'enabled', checked)
                    }
                  />
                </div>
                {agent.nextRun && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Next run: {new Date(agent.nextRun).toLocaleString()}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{agent.description}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`schedule-${index}`}>Cron Expression</Label>
                    <Input
                      id={`schedule-${index}`}
                      value={agent.schedule}
                      onChange={(e) =>
                        handleScheduleChange(index, 'schedule', e.target.value)
                      }
                      placeholder="0 6 * * *"
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Format: minute hour day month weekday
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Schedule Interpretation</Label>
                    <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                      {interpretCron(agent.schedule)}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Help Text */}
      <Card className="mt-6 bg-muted/50">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2">Cron Expression Help</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium mb-1">Common Patterns:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li><code className="bg-background px-1 rounded">0 6 * * *</code> - Daily at 6:00 AM</li>
                <li><code className="bg-background px-1 rounded">0 7,15 * * *</code> - Daily at 7:00 AM and 3:00 PM</li>
                <li><code className="bg-background px-1 rounded">0 16 * * 0</code> - Sundays at 4:00 PM</li>
              </ul>
            </div>
            <div>
              <p className="font-medium mb-1">Field Format:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>* - Any value</li>
                <li>7,15 - Multiple values (7 and 15)</li>
                <li>1-5 - Range (1 through 5)</li>
                <li>*/2 - Every 2nd value</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to Default Schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will discard all custom changes and restore the default agent schedule.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} disabled={isSaving}>
              {isSaving ? 'Resetting...' : 'Reset Schedule'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Helper function to interpret cron expressions in human-readable format
function interpretCron(cron: string): string {
  const parts = cron.split(' ');
  if (parts.length !== 5) return 'Invalid cron expression';

  const [minute, hour, day, month, weekday] = parts;

  let interpretation = 'Runs ';

  // Weekday
  if (weekday !== '*') {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekdayNums = weekday.split(',').map((d) => parseInt(d));
    interpretation += weekdayNums.map((d) => days[d]).join(', ') + ' ';
  } else {
    interpretation += 'daily ';
  }

  // Time
  if (hour !== '*') {
    const hours = hour.split(',');
    const times = hours.map((h) => {
      const hourNum = parseInt(h);
      const min = minute === '*' ? '00' : minute.padStart(2, '0');
      const period = hourNum >= 12 ? 'PM' : 'AM';
      const hour12 = hourNum > 12 ? hourNum - 12 : hourNum === 0 ? 12 : hourNum;
      return `${hour12}:${min} ${period}`;
    });

    interpretation += 'at ' + times.join(', ');
  } else {
    interpretation += 'every hour';
  }

  return interpretation;
}
