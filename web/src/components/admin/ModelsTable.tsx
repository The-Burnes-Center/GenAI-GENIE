import { DotsThree, PencilSimple, Play, Trash } from '@phosphor-icons/react'
import { Radio, RadioGroup } from 'react-aria-components'
import type { ModelConfig, ModelTestResult } from '../../api/types'
import { Badge, Button, CellText, IconButton, Menu, MenuItem, MenuTrigger, StatusChip, Switch, Table, type TableColumn } from '../ui'
import { capabilityLabels } from './models-helpers'

export type TestState = { status: 'pending' } | { status: 'done'; result: ModelTestResult }

export interface ModelsTableProps {
  models: ModelConfig[]
  defaultModelId: string
  tests: Record<string, TestState | undefined>
  onToggle: (model: ModelConfig) => void
  onDefault: (modelId: string) => void
  onTest: (model: ModelConfig) => void
  onEdit: (model: ModelConfig) => void
  onRemove: (model: ModelConfig) => void
}

function TestCell({ model, state, onTest }: { model: ModelConfig; state: TestState | undefined; onTest: (model: ModelConfig) => void }) {
  const isPending = state?.status === 'pending'
  const result = state?.status === 'done' ? state.result : null
  return (
    <div className="grid justify-items-start gap-1">
      <Button size="sm" isPending={isPending} pendingLabel="Testing" onPress={() => onTest(model)}>
        <Play size={14} aria-hidden="true" />
        Test now<span className="vh"> for {model.label}</span>
      </Button>
      {result?.ok && <StatusChip status="ready" label={`Passed, ${(result.latencyMs / 1000).toFixed(1)} s`} />}
      {result && !result.ok && (
        <>
          <StatusChip status="failed" />
          <span className="text-small text-danger">{result.error ?? 'The model did not answer.'}</span>
        </>
      )}
      {!state && <Badge>Not tested</Badge>}
    </div>
  )
}

function DefaultRadio({ model }: { model: ModelConfig }) {
  return (
    <Radio value={model.modelId} aria-label={`Make ${model.label} the default`} className="group inline-flex size-6 cursor-pointer items-center justify-center outline-none">
      <span className="grid size-[18px] place-items-center rounded-full border border-edge-strong bg-surface group-data-[selected]:border-accent group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-focus">
        <span className="hidden size-2.5 rounded-full bg-accent group-data-[selected]:block" />
      </span>
    </Radio>
  )
}

function RowMenu({ model, isDefault, props }: { model: ModelConfig; isDefault: boolean; props: ModelsTableProps }) {
  return (
    <MenuTrigger>
      <IconButton size="sm" label={`Actions for ${model.label}`}>
        <DotsThree size={20} weight="bold" aria-hidden="true" />
      </IconButton>
      <Menu
        aria-label={`Actions for ${model.label}`}
        placement="bottom end"
        disabledKeys={isDefault ? ['remove'] : []}
        onAction={(key) => (key === 'edit' ? props.onEdit(model) : props.onRemove(model))}
      >
        <MenuItem id="edit" icon={<PencilSimple size={18} />}>Edit</MenuItem>
        <MenuItem id="remove" isDanger icon={<Trash size={18} />}>{isDefault ? 'Remove (it is the default)' : 'Remove'}</MenuItem>
      </Menu>
    </MenuTrigger>
  )
}

export function ModelsTable(props: ModelsTableProps) {
  const { models, defaultModelId } = props
  const columns: TableColumn<ModelConfig>[] = [
    {
      id: 'model',
      header: 'Model',
      width: 'minmax(0,1.4fr)',
      isPrimary: true,
      cell: (model) => <CellText title={model.label} sub={<span className="font-mono">{model.modelId}</span>} />,
    },
    { id: 'provider', header: 'Provider', width: '84px', cell: (model) => model.provider },
    {
      id: 'can',
      header: 'Can do',
      width: 'minmax(0,1.6fr)',
      cell: (model) => (
        <span className="flex flex-wrap gap-1">
          {capabilityLabels(model.capabilities).map((label) => <Badge key={label}>{label}</Badge>)}
        </span>
      ),
    },
    {
      id: 'limits',
      header: 'Reads / writes',
      width: '152px',
      cell: (model) => (
        <span className="font-mono text-small">
          {model.contextWindow.toLocaleString()} / {model.maxOutputTokens.toLocaleString()}
        </span>
      ),
    },
    {
      id: 'on',
      header: 'On',
      width: '52px',
      cell: (model) => (
        <Switch isLabelHidden isSelected={model.enabled} onChange={() => props.onToggle(model)}>
          {`${model.label} is available to staff`}
        </Switch>
      ),
    },
    { id: 'default', header: 'Default', width: '64px', cell: (model) => <DefaultRadio model={model} /> },
    { id: 'test', header: 'Last test', width: '144px', cell: (model) => <TestCell model={model} state={props.tests[model.modelId]} onTest={props.onTest} /> },
    {
      id: 'actions',
      header: 'Actions',
      width: '44px',
      isActions: true,
      cell: (model) => <RowMenu model={model} isDefault={model.modelId === defaultModelId} props={props} />,
    },
  ]
  return (
    <RadioGroup aria-label="Default model" value={defaultModelId} onChange={props.onDefault}>
      <Table ariaLabel="Models" columns={columns} rows={models} getRowId={(model) => model.modelId} />
    </RadioGroup>
  )
}
