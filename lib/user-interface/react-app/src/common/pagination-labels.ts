import { PaginationProps } from "@cloudscape-design/components";

// Screen reader names for table page arrows and page numbers
export const PAGINATION_LABELS: PaginationProps.Labels = {
  nextPageLabel: "Next page",
  previousPageLabel: "Previous page",
  pageLabel: (pageNumber) => `Page ${pageNumber}`,
};
