import React from "react";
import {
  Button,
  Column,
  DataTable,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
} from "@carbon/react";
import { Edit, TrashCan, Checkmark } from "@carbon/react/icons";

const ProvidersSection = ({
  rows,
  headers,
  settings,
  onEditProvider,
  onDeleteProvider,
  onDefaultProviderChange,
}) => {
  // Helper to get providerData from row
  const getProviderData = (row) => {
    const providerDataCell = row.cells.find((c) => c.info.header === "providerData");
    return providerDataCell?.value;
  };

  return (
    <Column lg={16} md={8} sm={4}>
      <h5 className="settings-section-title">API Providers</h5>
      {rows.length === 0 ? (
        <div className="settings-empty-state">
          No providers configured. Click Add Provider to get started.
        </div>
      ) : (
        <DataTable rows={rows} headers={headers}>
          {({
            rows,
            headers,
            getHeaderProps,
            getRowProps,
            getTableProps,
            getTableContainerProps,
          }) => (
            <TableContainer {...getTableContainerProps()} className="settings-table-container">
              <Table {...getTableProps()}>
                <TableHead>
                  <TableRow>
                    {headers
                      .filter((header) => header.key !== "providerData")
                      .map((header) => (
                        <TableHeader {...getHeaderProps({ header })} key={header.key}>
                          {header.header}
                        </TableHeader>
                      ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => {
                    const providerData = getProviderData(row);
                    return (
                      <TableRow {...getRowProps({ row })} key={row.id}>
                        {row.cells.map((cell) => {
                          // Skip rendering providerData cell (it's just for data access)
                          if (cell.info.header === "providerData") {
                            return null;
                          }
                          if (cell.info.header === "isDefault") {
                            return (
                              <TableCell key={cell.id}>
                                {cell.value ? (
                                  <span className="settings-default-checkmark">
                                    <Checkmark size={20} />
                                  </span>
                                ) : (
                                  <Button
                                    kind="ghost"
                                    size="sm"
                                    onClick={() => onDefaultProviderChange(providerData)}
                                  >
                                    Make default
                                  </Button>
                                )}
                              </TableCell>
                            );
                          }
                          if (cell.info.header === "actions") {
                            return (
                              <TableCell key={cell.id}>
                                <div className="settings-actions">
                                  <Button
                                    kind="ghost"
                                    size="sm"
                                    renderIcon={Edit}
                                    iconDescription="Edit"
                                    hasIconOnly
                                    onClick={() => onEditProvider(providerData)}
                                  />
                                  <Button
                                    kind="ghost"
                                    size="sm"
                                    renderIcon={TrashCan}
                                    iconDescription="Delete"
                                    hasIconOnly
                                    onClick={() => onDeleteProvider(providerData)}
                                  />
                                </div>
                              </TableCell>
                            );
                          }
                          return <TableCell key={cell.id}>{cell.value}</TableCell>;
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>
      )}
    </Column>
  );
};

export default ProvidersSection;
