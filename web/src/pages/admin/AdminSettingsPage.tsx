import { useAdminSettings } from '../../api/admin-content'
import { useAdminModels } from '../../api/admin-models'
import { PageHead } from '../../components/admin/PageHead'
import { QueryError } from '../../components/admin/states'
import { SettingsForm } from '../../components/admin/SettingsForm'
import { SkeletonLines } from '../../components/ui'

export function AdminSettingsPage() {
  const settings = useAdminSettings()
  const models = useAdminModels()

  return (
    <>
      <PageHead title="Settings" lead="What staff see, how much they can use, how Genie helps new users, and who can sign up." />
      {settings.isError && <QueryError what="settings" error={settings.error} onRetry={() => void settings.refetch()} />}
      {models.isError && <QueryError what="the model list" error={models.error} onRetry={() => void models.refetch()} />}
      {(settings.isPending || models.isPending) && !settings.isError && !models.isError && <SkeletonLines count={6} label="Loading settings" />}
      {settings.data && models.data && <SettingsForm settings={settings.data} models={models.data.items} />}
    </>
  )
}
