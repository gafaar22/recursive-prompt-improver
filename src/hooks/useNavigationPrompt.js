import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Custom hook to prompt user before navigation when there are unsaved changes
 * Works with HashRouter by intercepting link clicks and back/forward navigation
 */
export const useNavigationPrompt = (when, onNavigate) => {
  const location = useLocation();
  const navigate = useNavigate();
  const lastLocation = useRef(location);
  const confirmedNavigation = useRef(false);
  const historyStateAdded = useRef(false);

  // Update last location when location changes
  useEffect(() => {
    lastLocation.current = location;
  }, [location]);

  // Handle browser back/forward with popstate
  useEffect(() => {
    if (!when) {
      historyStateAdded.current = false;
      return;
    }

    const handlePopState = async (event) => {
      if (confirmedNavigation.current) {
        confirmedNavigation.current = false;
        return;
      }

      // Block the navigation
      event.preventDefault();

      // Push the current state back to maintain position
      window.history.pushState(null, "", window.location.href);

      // Ask user what to do
      const result = await onNavigate();

      if (result.proceed) {
        confirmedNavigation.current = true;
        // Now actually navigate back
        window.history.back();
      }
    };

    // Add event listener for popstate
    window.addEventListener("popstate", handlePopState);

    // Push a dummy state to enable popstate events (only once)
    if (!historyStateAdded.current) {
      window.history.pushState(null, "", window.location.href);
      historyStateAdded.current = true;
    }

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [when, onNavigate]);

  // Intercept link clicks
  useEffect(() => {
    if (!when) {
      return;
    }

    const handleClick = async (event) => {
      // Check if this is a navigation link
      const link = event.target.closest("a");
      if (!link) {
        return;
      }

      const href = link.getAttribute("href");
      if (!href || !href.startsWith("#")) {
        return;
      }

      const targetPath = href.substring(1); // Remove the #

      // If navigating to same path, don't block
      if (targetPath === location.pathname) {
        return;
      }

      if (confirmedNavigation.current) {
        confirmedNavigation.current = false;
        return;
      }

      // Block the navigation
      event.preventDefault();

      // Ask user what to do
      const result = await onNavigate();

      if (result.proceed) {
        confirmedNavigation.current = true;
        navigate(targetPath);
      }
    };

    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [when, location.pathname, navigate, onNavigate]);

  return null;
};
