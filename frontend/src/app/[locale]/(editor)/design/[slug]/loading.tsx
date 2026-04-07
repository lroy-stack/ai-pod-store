import { getTranslations } from 'next-intl/server'

export default async function DesignEditorLoading() {
  const t = await getTranslations('designEditor')
  return (
    <div className="h-dvh w-full flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-full border-4 border-muted border-t-primary animate-spin" />
        <p className="text-sm text-muted-foreground animate-pulse">
          {t('loading')}
        </p>
      </div>
    </div>
  )
}
