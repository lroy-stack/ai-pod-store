'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChevronLeft, FileText, Calendar, Brain, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { SafeMarkdown } from '@/components/ui/safe-markdown'
import { adminFetch } from '@/lib/admin-api'

interface FileListItem {
  name: string
  selected: boolean
}

export default function MemoryExplorerPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('context')

  // Context files state
  const [contextFiles, setContextFiles] = useState<FileListItem[]>([])
  const [selectedContextFile, setSelectedContextFile] = useState<string | null>(null)
  const [contextContent, setContextContent] = useState<string>('')

  // Daily logs state
  const [dailyLogs, setDailyLogs] = useState<FileListItem[]>([])
  const [selectedLog, setSelectedLog] = useState<string | null>(null)
  const [logContent, setLogContent] = useState<string>('')

  // MEMORY.md state
  const [memoryContent, setMemoryContent] = useState<string>('')

  // SOUL.md state
  const [soulContent, setSoulContent] = useState<string>('')

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      // Load context files list
      const contextRes = await adminFetch('/api/agent/memory?type=context')
      if (contextRes.ok) {
        const data = await contextRes.json()
        setContextFiles(data.files.map((f: string) => ({ name: f, selected: false })))
      }

      // Load daily logs list
      const logsRes = await adminFetch('/api/agent/memory?type=logs')
      if (logsRes.ok) {
        const data = await logsRes.json()
        setDailyLogs(data.files.map((f: string) => ({ name: f, selected: false })))
      }

      // Load MEMORY.md
      const memoryRes = await adminFetch('/api/agent/memory?type=memory.md')
      if (memoryRes.ok) {
        const data = await memoryRes.json()
        setMemoryContent(data.content || '# MEMORY.md\n\nNo content.')
      }

      // Load SOUL.md
      const soulRes = await adminFetch('/api/agent/memory?type=soul.md')
      if (soulRes.ok) {
        const data = await soulRes.json()
        setSoulContent(data.content || '# SOUL.md\n\nNo content.')
      }
    } catch (error) {
      console.error('Failed to load memory data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadContextFile(filename: string) {
    try {
      const res = await adminFetch(`/api/agent/memory?type=context&file=${encodeURIComponent(filename)}`)
      if (res.ok) {
        const data = await res.json()
        setContextContent(data.content || '')
        setSelectedContextFile(filename)
      }
    } catch (error) {
      console.error('Failed to load context file:', error)
    }
  }

  async function loadDailyLog(filename: string) {
    try {
      const res = await adminFetch(`/api/agent/memory?type=logs&file=${encodeURIComponent(filename)}`)
      if (res.ok) {
        const data = await res.json()
        setLogContent(data.content || '')
        setSelectedLog(filename)
      }
    } catch (error) {
      console.error('Failed to load daily log:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <span className="text-foreground">Admin</span>
        <span>&gt;</span>
        <button onClick={() => router.push('/agent')} className="hover:text-foreground">
          Agent Monitor
        </button>
        <span>&gt;</span>
        <span>Memory Explorer</span>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/agent')}
              className="p-0 h-auto hover:bg-transparent"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-3xl font-bold">Memory Explorer</h1>
          </div>
          <p className="text-muted-foreground">
            Browse PodClaw&apos;s context files, daily logs, and memory
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="context" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden md:inline">Context Files</span>
            <span className="md:hidden">Context</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden md:inline">Daily Logs</span>
            <span className="md:hidden">Logs</span>
          </TabsTrigger>
          <TabsTrigger value="memory" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            <span>MEMORY</span>
          </TabsTrigger>
          <TabsTrigger value="soul" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span>SOUL</span>
          </TabsTrigger>
        </TabsList>

        {/* Context Files Tab */}
        <TabsContent value="context" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* File List */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">Context Files</CardTitle>
                <CardDescription>
                  {contextFiles.length} files
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] md:h-[500px]">
                  <div className="space-y-2">
                    {loading ? (
                      <div className="space-y-2">
                        <div className="h-8 bg-muted animate-pulse rounded" />
                        <div className="h-8 bg-muted animate-pulse rounded" />
                        <div className="h-8 bg-muted animate-pulse rounded" />
                      </div>
                    ) : contextFiles.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No context files found</p>
                    ) : (
                      contextFiles.map((file) => (
                        <Button
                          key={file.name}
                          variant={selectedContextFile === file.name ? 'secondary' : 'ghost'}
                          className="w-full justify-start text-left"
                          onClick={() => loadContextFile(file.name)}
                        >
                          <FileText className="h-4 w-4 mr-2 shrink-0" />
                          <span className="truncate">{file.name}</span>
                        </Button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* File Content */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">
                  {selectedContextFile || 'Select a file'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] md:h-[500px]">
                  {selectedContextFile ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <SafeMarkdown>
                        {contextContent}
                      </SafeMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Select a context file to view its content
                    </p>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Daily Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Log List */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">Daily Logs</CardTitle>
                <CardDescription>
                  {dailyLogs.length} logs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] md:h-[500px]">
                  <div className="space-y-2">
                    {loading ? (
                      <div className="space-y-2">
                        <div className="h-8 bg-muted animate-pulse rounded" />
                        <div className="h-8 bg-muted animate-pulse rounded" />
                        <div className="h-8 bg-muted animate-pulse rounded" />
                      </div>
                    ) : dailyLogs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No daily logs found</p>
                    ) : (
                      dailyLogs.map((file) => (
                        <Button
                          key={file.name}
                          variant={selectedLog === file.name ? 'secondary' : 'ghost'}
                          className="w-full justify-start text-left"
                          onClick={() => loadDailyLog(file.name)}
                        >
                          <Calendar className="h-4 w-4 mr-2 shrink-0" />
                          <span className="truncate">{file.name}</span>
                        </Button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Log Content */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">
                  {selectedLog || 'Select a log'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] md:h-[500px]">
                  {selectedLog ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <SafeMarkdown>
                        {logContent}
                      </SafeMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Select a daily log to view its content
                    </p>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* MEMORY.md Tab */}
        <TabsContent value="memory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                MEMORY.md
              </CardTitle>
              <CardDescription>
                PodClaw&apos;s long-term memory and context
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] md:h-[600px]">
                {loading ? (
                  <div className="space-y-3">
                    <div className="h-6 bg-muted animate-pulse rounded w-3/4" />
                    <div className="h-4 bg-muted animate-pulse rounded w-full" />
                    <div className="h-4 bg-muted animate-pulse rounded w-5/6" />
                    <div className="h-4 bg-muted animate-pulse rounded w-full" />
                  </div>
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <SafeMarkdown>
                      {memoryContent}
                    </SafeMarkdown>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SOUL.md Tab */}
        <TabsContent value="soul" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                SOUL.md
              </CardTitle>
              <CardDescription>
                PodClaw&apos;s personality, values, and behavioral guidelines
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] md:h-[600px]">
                {loading ? (
                  <div className="space-y-3">
                    <div className="h-6 bg-muted animate-pulse rounded w-3/4" />
                    <div className="h-4 bg-muted animate-pulse rounded w-full" />
                    <div className="h-4 bg-muted animate-pulse rounded w-5/6" />
                    <div className="h-4 bg-muted animate-pulse rounded w-full" />
                  </div>
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <SafeMarkdown>
                      {soulContent}
                    </SafeMarkdown>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
