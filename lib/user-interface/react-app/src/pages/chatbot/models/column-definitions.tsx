import { TableProps } from "@cloudscape-design/components";
import {
  PropertyFilterProperty,
  PropertyFilterOperator,
} from "@cloudscape-design/collection-hooks";
import { Model } from "../../../API";

// A model row with the display values the table and filter use
export type ModelRow = Model & {
  providerName: string;
  canRead: string;
};

export const ModelsColumnDefinitions: TableProps.ColumnDefinition<ModelRow>[] = [
  {
    id: "name",
    header: "Name",
    sortingField: "name",
    cell: (item: ModelRow) => item.name,
    isRowHeader: true,
  },
  {
    id: "provider",
    header: "Provider",
    sortingField: "providerName",
    cell: (item: ModelRow) => item.providerName,
  },
  {
    id: "canRead",
    header: "Can read",
    sortingField: "canRead",
    cell: (item: ModelRow) => item.canRead,
  },
];

export const ModelsColumnFilteringProperties: PropertyFilterProperty[] = [
  {
    propertyLabel: "Name",
    key: "name",
    groupValuesLabel: "Name values",
    operators: [":", "!:", "=", "!="] as PropertyFilterOperator[],
  },
  {
    propertyLabel: "Provider",
    key: "providerName",
    groupValuesLabel: "Provider values",
    operators: [":", "!:", "=", "!="] as PropertyFilterOperator[],
  },
  {
    propertyLabel: "Can read",
    key: "canRead",
    groupValuesLabel: "Can read values",
    operators: [":", "!:", "=", "!="] as PropertyFilterOperator[],
  },
].sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel));
