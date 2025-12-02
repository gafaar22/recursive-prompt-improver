import React, { useState, useEffect, useMemo, memo } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Header,
  HeaderContainer,
  HeaderName,
  HeaderNavigation,
  HeaderMenuItem,
  HeaderMenuButton,
  HeaderSideNavItems,
  InlineLoading,
  SideNav,
  SideNavItems,
  Tooltip,
} from "@carbon/react";
import { WarningFilled, NetworkPublic, Wifi } from "@carbon/react/icons";
import { useLoading } from "@context/LoadingContext";
import { useSettings } from "@context/SettingsContext";
import { useKnowledge } from "@context/KnowledgeContext";
import { getExposedServerStatus, getExposedServerConfig } from "@core/MCP";

// Separate component for Knowledge menu item to isolate re-renders
const KnowledgeMenuItem = memo(({ isCurrentPage }) => {
  const { isAnyIndexing } = useKnowledge();
  return (
    <HeaderMenuItem element={Link} to="/knowledge" isCurrentPage={isCurrentPage}>
      {isAnyIndexing ? <InlineLoading description="Indexing" status="active" /> : "Knowledge"}
    </HeaderMenuItem>
  );
});

// Separate component for Knowledge side nav item
const KnowledgeSideNavItem = memo(() => {
  const { isAnyIndexing } = useKnowledge();
  return (
    <HeaderMenuItem element={Link} to="/knowledge">
      {isAnyIndexing ? <InlineLoading description="Indexing" status="active" /> : "Knowledge"}
    </HeaderMenuItem>
  );
});

const AppHeader = () => {
  const location = useLocation();
  const { isLoading } = useLoading();
  const { settings } = useSettings();
  const [mcpServerStatus, setMcpServerStatus] = useState({ isRunning: false, port: null });

  const hasNoProviders = !settings.providers || settings.providers.length === 0;

  // Poll MCP server status
  useEffect(() => {
    const checkServerStatus = async () => {
      try {
        const status = await getExposedServerStatus();
        if (status.isRunning) {
          const config = await getExposedServerConfig();
          const newPort = config.port;
          const newToolCount = config.selectedItems?.length || 0;
          setMcpServerStatus((prev) => {
            if (prev.isRunning && prev.port === newPort && prev.toolCount === newToolCount) {
              return prev; // No change, return same reference
            }
            return { isRunning: true, port: newPort, toolCount: newToolCount };
          });
        } else {
          setMcpServerStatus((prev) => {
            if (!prev.isRunning) return prev; // Already not running
            return { isRunning: false, port: null, toolCount: 0 };
          });
        }
      } catch {
        setMcpServerStatus((prev) => {
          if (!prev.isRunning) return prev;
          return { isRunning: false, port: null, toolCount: 0 };
        });
      }
    };

    checkServerStatus();
    const interval = setInterval(checkServerStatus, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, []);

  const mcpIndicator = useMemo(() => {
    if (!mcpServerStatus.isRunning) return null;
    return (
      <Tooltip
        align="bottom"
        label={`MCP Server on port ${mcpServerStatus.port} (${mcpServerStatus.toolCount} tool${mcpServerStatus.toolCount !== 1 ? "s" : ""})`}
      >
        <span className="mcp-server-indicator attention-pulse">
          <Wifi size={10} color="#fff" />
        </span>
      </Tooltip>
    );
  }, [mcpServerStatus.isRunning, mcpServerStatus.port, mcpServerStatus.toolCount]);

  return (
    <HeaderContainer
      render={({ isSideNavExpanded, onClickSideNavExpand }) => (
        <Header aria-label="RPI App">
          <HeaderMenuButton
            aria-label={isSideNavExpanded ? "Close menu" : "Open menu"}
            onClick={onClickSideNavExpand}
            isActive={isSideNavExpanded}
            aria-expanded={isSideNavExpanded}
          />
          <HeaderName element={Link} to="/" prefix=" ">
            RPI
          </HeaderName>
          <HeaderNavigation aria-label="RPI App">
            <HeaderMenuItem
              element={Link}
              to="/"
              isCurrentPage={location.pathname === "/" || location.pathname === "/sessions"}
            >
              {isLoading ? <InlineLoading description={"Running"} status="active" /> : "Run"}
            </HeaderMenuItem>
            <HeaderMenuItem
              element={Link}
              to="/agents"
              isCurrentPage={location.pathname === "/agents"}
            >
              Agents
            </HeaderMenuItem>
            <HeaderMenuItem
              element={Link}
              to="/conversations"
              isCurrentPage={location.pathname === "/conversations"}
            >
              Conversations
            </HeaderMenuItem>
            <KnowledgeMenuItem isCurrentPage={location.pathname === "/knowledge"} />
            <HeaderMenuItem
              element={Link}
              to="/tools"
              isCurrentPage={location.pathname === "/tools"}
            >
              Tools
            </HeaderMenuItem>
            <HeaderMenuItem element={Link} to="/mcp" isCurrentPage={location.pathname === "/mcp"}>
              {mcpIndicator}
              MCP
            </HeaderMenuItem>
            <HeaderMenuItem
              element={Link}
              to="/settings"
              isCurrentPage={location.pathname === "/settings"}
            >
              {hasNoProviders && <WarningFilled size={16} className="header-warning-icon" />}
              Settings
            </HeaderMenuItem>
          </HeaderNavigation>
          <SideNav
            aria-label="Side navigation"
            expanded={isSideNavExpanded}
            isPersistent={false}
            onSideNavBlur={onClickSideNavExpand}
          >
            <SideNavItems>
              <HeaderSideNavItems>
                <HeaderMenuItem element={Link} to="/">
                  {isLoading ? <InlineLoading description={"Running"} status="active" /> : "Run"}
                </HeaderMenuItem>
                <HeaderMenuItem element={Link} to="/agents">
                  Agents
                </HeaderMenuItem>
                <HeaderMenuItem element={Link} to="/conversations">
                  Conversations
                </HeaderMenuItem>
                <HeaderMenuItem element={Link} to="/tools">
                  Tools
                </HeaderMenuItem>
                <KnowledgeSideNavItem />
                <HeaderMenuItem element={Link} to="/mcp">
                  {mcpIndicator}
                  MCP
                </HeaderMenuItem>
                <HeaderMenuItem element={Link} to="/settings">
                  {hasNoProviders && <WarningFilled size={16} className="header-warning-icon" />}
                  Settings
                </HeaderMenuItem>
              </HeaderSideNavItems>
            </SideNavItems>
          </SideNav>
        </Header>
      )}
    />
  );
};

export default AppHeader;
