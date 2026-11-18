import { PAGINATION_LABELS } from "../../../common/pagination-labels";
import {
  BreadcrumbGroup,
  Header,
  HelpPanel,
  Pagination,
  PropertyFilter,
  Table,
} from "@cloudscape-design/components";
import useOnFollow from "../../../common/hooks/use-on-follow";
import BaseAppLayout from "../../../components/base-app-layout";
import { useContext, useState, useCallback, useEffect, useMemo } from "react";
import { useCollection } from "@cloudscape-design/collection-hooks";
import { ApiClient } from "../../../common/api-client/api-client";
import { AppContext } from "../../../common/app-context";
import { TextHelper } from "../../../common/helpers/text-helper";
import { ModelDisplayHelper } from "../../../common/helpers/model-display-helper";
import { PropertyFilterI18nStrings } from "../../../common/i18n/property-filter-i18n-strings";
import { TableEmptyState } from "../../../components/table-empty-state";
import { TableNoMatchState } from "../../../components/table-no-match-state";
import {
  ModelRow,
  ModelsColumnDefinitions,
  ModelsColumnFilteringProperties,
} from "./column-definitions";
import { CHATBOT_NAME } from "../../../common/constants";
import { Model } from "../../../API";
import { Utils } from "../../../common/utils";

const SMART_MODEL_NAME = "Smart Model";

export default function Models() {
  const onFollow = useOnFollow();
  const appContext = useContext(AppContext);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);

  // Smart Model comes first, then the rest grouped by provider and name
  const rows: ModelRow[] = useMemo(() => {
    return models
      .map((model) => ({
        ...model,
        providerName: ModelDisplayHelper.getProviderName(model),
        canRead: ModelDisplayHelper.getCanRead(model.inputModalities),
      }))
      .sort((a, b) => {
        if (a.name === SMART_MODEL_NAME) return -1;
        if (b.name === SMART_MODEL_NAME) return 1;
        return (
          a.providerName.localeCompare(b.providerName) ||
          a.name.localeCompare(b.name)
        );
      });
  }, [models]);

  const {
    items,
    actions,
    filteredItemsCount,
    collectionProps,
    paginationProps,
    propertyFilterProps,
  } = useCollection(rows, {
    propertyFiltering: {
      filteringProperties: ModelsColumnFilteringProperties,
      empty: <TableEmptyState resourceName="model" />,
      noMatch: (
        <TableNoMatchState
          onClearFilter={() => {
            actions.setPropertyFiltering({ tokens: [], operation: "and" });
          }}
        />
      ),
    },
    pagination: { pageSize: 50 },
    sorting: {},
    selection: {},
  });

  const getModels = useCallback(async () => {
    if (!appContext) return;

    const apiClient = new ApiClient(appContext);
    try {
      const result = await apiClient.models.getModels();

      setModels(result.data!.listModels);
    } catch (error) {
      console.error(Utils.getErrorMessage(error));
    }
    setLoading(false);
  }, [appContext]);

  useEffect(() => {
    if (!appContext) return;

    getModels();
  }, [appContext, getModels]);

  return (
    <BaseAppLayout
      contentType="table"
      breadcrumbs={
        <BreadcrumbGroup
          onFollow={onFollow}
          items={[
            {
              text: CHATBOT_NAME,
              href: "/",
            },
            {
              text: "Models",
              href: "/chatbot/models",
            },
          ]}
        />
      }
      content={
        <Table
          {...collectionProps}
          items={items}
          columnDefinitions={ModelsColumnDefinitions}
          variant="full-page"
          stickyHeader={true}
          resizableColumns={true}
          wrapLines={true}
          header={
            <Header
              variant="awsui-h1-sticky"
              description="GENIE can use these models. Smart Model picks one for you."
            >
              Available models
            </Header>
          }
          loading={loading}
          loadingText="Loading models"
          filter={
            <PropertyFilter
              {...propertyFilterProps}
              i18nStrings={PropertyFilterI18nStrings}
              filteringPlaceholder={"Filter models"}
              countText={TextHelper.getTextFilterCounterText(
                filteredItemsCount
              )}
              expandToViewport={true}
            />
          }
          pagination={<Pagination {...paginationProps} ariaLabels={PAGINATION_LABELS} />}
        />
      }
      info={
        <HelpPanel header={<Header variant="h3">Available models</Header>}>
          <p>
            Not sure which model to use? Start with Smart Model. It picks a
            model based on your question.
          </p>
          <p>
            To choose a model yourself, open the model menu under the message
            box in Chat.
          </p>
          <p>
            "Can read" shows what you can send to a model, such as text, images
            or documents.
          </p>
        </HelpPanel>
      }
    />
  );
}
