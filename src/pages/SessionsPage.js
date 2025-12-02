import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { blue40, gray30 } from "@carbon/colors";
import { useToast } from "@context/ToastContext";
import { useConfirm } from "@context/ConfirmContext";
import {
  usePagination,
  useSearchAndFilter,
  useLocalStorageData,
  useConfirmDelete,
  useImportExport,
} from "@hooks";
import { truncateText } from "@utils/uiUtils";
import ReactECharts from "echarts-for-react";
import {
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableContainer,
  Button,
  Grid,
  Column,
  Pagination,
  Search,
  OverflowMenu,
  OverflowMenuItem,
  InlineLoading,
  DataTableSkeleton,
} from "@carbon/react";
import {
  View,
  Menu,
  SearchLocateMirror,
  ChartAverage,
  Play,
  Download,
  TrashCan,
} from "@carbon/icons-react";
import {
  loadSessions,
  deleteSession,
  clearAllSessions,
  loadSessionIntoForm,
  saveSession,
} from "@utils/storageUtils";
import { formatDate } from "@utils/uiUtils";
import SessionDetailsModal from "@components/modals/SessionDetailsModal";
import EmptyState from "@components/shared/EmptyState";
import { useLoading } from "@context/LoadingContext";
import { ProviderIcon } from "@components/SettingsComponent/SettingsComponent.utils";

const headers = [
  { key: "timestamp", header: "Date" },
  { key: "model", header: "Test Model" },
  { key: "instructions", header: "Instructions" },
  { key: "iterations", header: "Iterations / Test" },
  { key: "actions", header: "" },
];

const SessionsPage = () => {
  const navigate = useNavigate();
  const { showSuccess } = useToast();
  const { confirm } = useConfirm();
  const { isLoading } = useLoading();

  // Load sessions from localStorage
  const {
    data: sessions,
    isLoading: isLoadingSessions,
    setData: setSessions,
  } = useLocalStorageData(loadSessions);

  // Search and filter matcher
  const sessionMatcher = useCallback((session, lowercaseTerm) => {
    const instructionsMatch = session.instructions.toLowerCase().includes(lowercaseTerm);
    const modelMatch =
      session.coreModel && session.coreModel.text.toLowerCase().includes(lowercaseTerm);
    return instructionsMatch || modelMatch;
  }, []);

  // Search and filter
  const {
    searchTerm,
    filteredItems: filteredSessions,
    totalItems,
    handleSearchChange,
  } = useSearchAndFilter(sessions, sessionMatcher, {
    onSearchChange: () => resetPage(),
  });

  // Pagination
  const {
    currentPage,
    pageSize,
    paginatedData: paginatedSessions,
    handlePageChange,
    resetPage,
  } = usePagination(filteredSessions, { initialPageSize: 10 });

  // Modal state
  const [selectedSession, setSelectedSession] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Delete handlers with confirmation
  const { handleDelete, handleClearAll } = useConfirmDelete({ setData: setSessions });

  const handleDeleteSession = handleDelete({
    title: "Delete Session",
    body: "Are you sure you want to delete this session?",
    deleteOperation: (id) => deleteSession(id),
    successMessage: "Session deleted",
    successDescription: "The session has been removed",
  });

  const handleClearAllSessions = handleClearAll({
    title: "Clear All Sessions",
    body: "Are you sure you want to delete all sessions? This action cannot be undone.",
    deleteOperation: () => clearAllSessions(),
    successMessage: "All sessions cleared",
    successDescription: "All session history has been removed",
  });

  const handleViewSession = (session) => {
    setSelectedSession(session);
    setIsModalOpen(true);
  };

  const handleLoadSession = async (session) => {
    const isConfirmed = await confirm({
      title: "Load Session",
      body: "Are you sure you want to load this session into the form? Current form data will be replaced.",
      confirmText: "Load",
      cancelText: "Cancel",
      variant: "warning",
    });

    if (isConfirmed) {
      await loadSessionIntoForm(session || selectedSession);
      setIsModalOpen(false);
      showSuccess("Session loaded", "Session data has been loaded into the form.");
      navigate("/");
    }
  };

  // Import/Export handlers
  const { handleExport, handleImport } = useImportExport();

  const handleExportSession = handleExport({
    getFilename: (session) => `RPI-session-${session.id}`,
    successMessage: "Session exported",
    successDescription: "The session has been exported as JSON file",
  });

  const handleImportSession = handleImport({
    requiredFields: ["timestamp", "instructions"],
    onImport: async (importedData) => {
      // Create a new session with the imported data
      // Handle both old format (selectedModel) and new format (coreModel)
      const sessionData = {
        timestamp: importedData.timestamp,
        instructions: importedData.instructions,
        inOutPairs: importedData.inOutPairs || [],
        iterations: importedData.iterations || 1,
        coreModel: importedData.coreModel || importedData.selectedModel,
        improveMode: importedData.improveMode !== undefined ? importedData.improveMode : true,
        settingsModel: importedData.settingsModel,
        settingsEmbeddingModel: importedData.settingsEmbeddingModel,
        selectedTools: importedData.selectedTools || [],
      };

      await saveSession(sessionData, importedData.output || [], importedData.tests || []);

      // Refresh sessions list
      const allSessions = await loadSessions();
      setSessions(allSessions);

      showSuccess("Session imported", "The session has been imported successfully");
    },
  });

  const getTestChartOpts = (session) => {
    if (!session?.tests?.length) {
      return {};
    }
    const option = {
      backgroundColor: "transparent",
      tooltip: {
        appendToBody: true,
        trigger: "axis",
        valueFormatter: (value) => `${value?.toFixed(2)}%`,
      },
      color: [blue40, gray30],
      grid: {
        left: "1%",
        right: "1%",
        top: "1%",
        bottom: "1%",
        containLabel: false,
      },
      yAxis: {
        type: "value",
        min: 0,
        max: 100,
        interval: 25,
        splitLine: {
          show: true,
        },
        axisLine: {
          show: false,
        },
        axisLabel: {
          show: false,
        },
      },
      legend: {
        show: false,
      },
      xAxis: {
        type: "category",
        axisTick: { show: false, alignWithLabel: true },
        axisLine: {
          show: false,
        },
        axisLabel: {
          show: false,
        },
        boundaryGap: false,
        data: session.tests?.map((tg, i) => `${i + 1}° Iteration`),
      },
      series: [
        {
          name: "Score (avg)",
          type: "line",
          data: session.tests?.map(
            (iter) => iter?.reduce((sum, a) => sum + parseFloat(a.aiScore), 0) / (iter?.length || 1)
          ),
        },
        {
          name: "Similarity (avg)",
          type: "line",
          data: session.tests?.map(
            (iter) =>
              iter?.reduce((sum, a) => sum + Math.round(parseFloat(a.similarity * 100)), 0) /
              (iter?.length || 1)
          ),
        },
      ],
    };
    return option;
  };

  const rows = paginatedSessions.map((session) => ({
    id: session.id.toString(),
    timestamp: formatDate(session.timestamp),
    model: session.coreModel ? (
      <span className="flex-align-center gap-05">
        <ProviderIcon providerId={session.coreModel.providerId} size={16} />
        {session.coreModel.text || session.coreModel.originalText || "Unknown model"}
      </span>
    ) : (
      "Unknown model"
    ),
    iterations:
      session.improveMode === false ? (
        <span title="Test only" className="chart-container">
          {session.tests.map((tg) =>
            tg.map((t, k) => <span key={k}>{t.isEqual ? "100% " : `${t.aiScore}% `}</span>)
          )}
        </span>
      ) : (
        <ReactECharts
          theme="dark"
          style={{ height: "30px", width: "220px" }}
          option={getTestChartOpts(session)}
        />
      ),
    instructions: (
      <span title={session.instructions}>{truncateText(session.instructions, 20)}</span>
    ),
    actions: (
      <div className="tableActionsContainer">
        <div></div>
        <div className="tableActionsDiv">
          <Button
            kind="ghost"
            size="sm"
            renderIcon={View}
            iconDescription="View"
            hasIconOnly
            tooltipPosition="top"
            onClick={() => handleViewSession(session)}
          >
            View
          </Button>
          <Button
            kind="ghost"
            size="sm"
            renderIcon={Play}
            iconDescription="Load"
            hasIconOnly
            tooltipPosition="top"
            onClick={() => handleLoadSession(session)}
            disabled={isLoading}
          />
          <Button
            kind="ghost"
            size="sm"
            renderIcon={Download}
            iconDescription="Export"
            hasIconOnly
            tooltipPosition="top"
            onClick={() => handleExportSession(session)}
            disabled={isLoading}
          />
          <Button
            kind="ghost"
            size="sm"
            renderIcon={TrashCan}
            iconDescription="Delete"
            hasIconOnly
            tooltipPosition="top"
            onClick={() => handleDeleteSession(session.id)}
            disabled={isLoading}
          />
        </div>
      </div>
    ),
  }));

  return (
    <div className="margin-bottom-2rem">
      <div className="sessionsPage">
        <h1 className="sectionTitle">Sessions</h1>
        <div className="flex-center">
          <Button
            size="md"
            renderIcon={Play}
            kind="tertiary"
            onClick={() => navigate("/")}
            className="margin-right-1rem"
          >
            Run
          </Button>
          <Search
            labelText="Search"
            placeholder="Search in instructions or model"
            onChange={handleSearchChange}
            value={searchTerm}
            size="md"
            className=""
            disabled={!sessions || !sessions.length}
          />
          <OverflowMenu
            className="margin-left-1rem"
            size="md"
            flipped
            aria-label="Sessions menu"
            renderIcon={Menu}
          >
            <OverflowMenuItem itemText="Import session" onClick={handleImportSession} />
            <OverflowMenuItem
              hasDivider
              itemText="Clear All Sessions"
              onClick={handleClearAllSessions}
              isDelete
              disabled={!sessions || !sessions.length}
            />
          </OverflowMenu>
        </div>
      </div>
      <Grid className="row-gap-0">
        <Column lg={16} md={8} sm={4}>
          {isLoadingSessions ? (
            <DataTableSkeleton
              showHeader={false}
              showToolbar={false}
              headers={headers}
              rowCount={pageSize}
              columnCount={headers.length}
            />
          ) : !sessions || sessions.length === 0 ? (
            <EmptyState
              icon={ChartAverage}
              title="No sessions yet"
              description="Run some prompts to create sessions and view your prompt testing history."
            />
          ) : filteredSessions.length === 0 ? (
            <EmptyState
              icon={SearchLocateMirror}
              title="No matching sessions"
              description="No sessions match your search criteria. Try a different search term."
            />
          ) : (
            <DataTable rows={rows} headers={headers}>
              {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
                <TableContainer>
                  <Table {...getTableProps()}>
                    <TableHead>
                      <TableRow>
                        {headers.map((header, idx) => (
                          <TableHeader {...getHeaderProps({ header })} key={idx}>
                            {header.header}
                          </TableHeader>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {isLoading && (
                        <TableRow key={"loading"}>
                          {headers.map((h, i) => (
                            <TableCell key={`${i}`}>
                              {i === 0 && (
                                <InlineLoading
                                  description={"Session is running..."}
                                  status="active"
                                />
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      )}
                      {rows.map((row, idx) => (
                        <TableRow {...getRowProps({ row })} key={idx}>
                          {row.cells.map((cell) => (
                            <TableCell key={cell.id}>{cell.value}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DataTable>
          )}
        </Column>
        {isLoadingSessions ||
        !sessions ||
        sessions.length === 0 ||
        filteredSessions.length === 0 ? (
          <></>
        ) : (
          <Column lg={16} md={8} sm={4}>
            <Pagination
              backwardText="Previous page"
              forwardText="Next page"
              itemsPerPageText="Items per page:"
              pageNumberText="Page Number"
              pageSize={pageSize}
              pageSizes={[5, 10, 15, 25, 50]}
              totalItems={totalItems}
              page={currentPage}
              onChange={handlePageChange}
            />
          </Column>
        )}
      </Grid>

      <SessionDetailsModal
        isOpen={isModalOpen}
        session={isModalOpen ? selectedSession : null}
        onClose={() => setIsModalOpen(false)}
        onLoadIntoForm={handleLoadSession}
      />
    </div>
  );
};

export default SessionsPage;
