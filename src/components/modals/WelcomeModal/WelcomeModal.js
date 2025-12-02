import React, { useState, useEffect, useRef } from "react";
import { Modal, Button, InlineLoading } from "@carbon/react";
import { Checkmark, ChevronRight, Upload } from "@carbon/icons-react";
import Lottie from "lottie-react";
import welcomeAnimation from "@assets/animations/welcome.json";
import ollamaAnimation from "@assets/animations/ollama.json";
import lmstudioAnimation from "@assets/animations/lmstudio.json";
import backupAnimation from "@assets/animations/backup.json";
import completeAnimation from "@assets/animations/complete.json";
import { checkOllamaInstalled, checkLMStudioInstalled } from "@utils/systemCheck";
import { fetchAndUpdateProviderModels } from "@utils/uiUtils";
import { useSettings } from "@context/SettingsContext";
import { useFullBackupImport } from "@hooks";

const STEPS = {
  WELCOME: "welcome",
  OLLAMA_CHECK: "ollama_check",
  OLLAMA_FOUND: "ollama_found",
  OLLAMA_SETUP: "ollama_setup",
  LMSTUDIO_CHECK: "lmstudio_check",
  LMSTUDIO_FOUND: "lmstudio_found",
  LMSTUDIO_SETUP: "lmstudio_setup",
  BACKUP: "backup",
  COMPLETE: "complete",
};

const TRANSITION_DURATION = 300; // ms for fade animation
const MIN_CHECK_DELAY = 1500; // minimum time to show checking state

const WelcomeModal = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(STEPS.WELCOME);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [hasTransitioned, setHasTransitioned] = useState(false);
  const [ollamaResult, setOllamaResult] = useState(null);
  const [lmstudioResult, setLmstudioResult] = useState(null);
  const [isSettingUpOllama, setIsSettingUpOllama] = useState(false);
  const [isSettingUpLmstudio, setIsSettingUpLmstudio] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [isExiting, setIsExiting] = useState(false);
  const { settings, updateAndSaveSettings } = useSettings();
  const { importFullBackup } = useFullBackupImport();
  const lottieRef = useRef(null);

  // Check if providers already exist
  const hasOllamaProvider = settings.providers?.some((p) => p.id === "ollama");
  const hasLmstudioProvider = settings.providers?.some((p) => p.id === "lmstudio");

  // Transition to a new step with fade effect
  const transitionToStep = (newStep) => {
    setIsTransitioning(true);
    setHasTransitioned(true);
    setTimeout(() => {
      setStep(newStep);
      setIsTransitioning(false);
    }, TRANSITION_DURATION);
  };

  // Check for Ollama when entering the ollama_check step
  useEffect(() => {
    if (step === STEPS.OLLAMA_CHECK) {
      // Skip if Ollama provider already exists
      if (hasOllamaProvider) {
        transitionToStep(STEPS.LMSTUDIO_CHECK);
        return;
      }

      const checkOllama = async () => {
        const startTime = Date.now();
        const result = await checkOllamaInstalled();
        setOllamaResult(result);

        // Ensure minimum delay for better UX
        const elapsed = Date.now() - startTime;
        const remainingDelay = Math.max(0, MIN_CHECK_DELAY - elapsed);

        setTimeout(() => {
          if (result.found) {
            transitionToStep(STEPS.OLLAMA_FOUND);
          } else {
            // No Ollama found, check for LM Studio
            transitionToStep(STEPS.LMSTUDIO_CHECK);
          }
        }, remainingDelay);
      };
      checkOllama();
    }
  }, [step, hasOllamaProvider]);

  // Check for LM Studio when entering the lmstudio_check step
  useEffect(() => {
    if (step === STEPS.LMSTUDIO_CHECK) {
      // Skip if LM Studio provider already exists
      if (hasLmstudioProvider) {
        transitionToStep(STEPS.BACKUP);
        return;
      }

      const checkLmstudio = async () => {
        const startTime = Date.now();
        const result = await checkLMStudioInstalled();
        setLmstudioResult(result);

        // Ensure minimum delay for better UX
        const elapsed = Date.now() - startTime;
        const remainingDelay = Math.max(0, MIN_CHECK_DELAY - elapsed);

        setTimeout(() => {
          if (result.found) {
            transitionToStep(STEPS.LMSTUDIO_FOUND);
          } else {
            // No LM Studio found, skip to backup step
            transitionToStep(STEPS.BACKUP);
          }
        }, remainingDelay);
      };
      checkLmstudio();
    }
  }, [step, hasLmstudioProvider]);

  const handleStart = () => {
    transitionToStep(STEPS.OLLAMA_CHECK);
  };

  const handleUseOllama = async () => {
    setIsSettingUpOllama(true);

    // Create Ollama provider configuration
    const ollamaProvider = {
      id: "ollama",
      name: "Ollama (Local)",
      ollamaUrl: ollamaResult.url,
      apiKey: "",
      projectId: "",
      watsonxUrl: "",
      selectedModel: ollamaResult.models.find((m) => !m.id.toLowerCase().includes("embed")) || null,
      selectedEmbeddingModel:
        ollamaResult.models.find((m) => m.id.toLowerCase().includes("embed")) || null,
    };

    // Fetch full models list with metadata before saving
    let providerToSave = ollamaProvider;
    try {
      providerToSave = await fetchAndUpdateProviderModels(ollamaProvider);
    } catch (error) {
      console.warn("Failed to fetch Ollama models, using basic config:", error);
    }

    // Update settings with the new provider
    const updatedProviders = [...(settings.providers || []), providerToSave];
    await updateAndSaveSettings({
      providers: updatedProviders,
      defaultProviderId: "ollama",
    });

    // Add a small delay for better UX, then transition
    // Keep isSettingUpOllama true until after transition completes to avoid glitch
    setTimeout(() => {
      transitionToStep(STEPS.LMSTUDIO_CHECK);
      // Reset after transition animation completes
      setTimeout(() => {
        setIsSettingUpOllama(false);
      }, TRANSITION_DURATION);
    }, 800);
  };

  const handleMaybeLater = () => {
    transitionToStep(STEPS.LMSTUDIO_CHECK);
  };

  const handleUseLmstudio = async () => {
    setIsSettingUpLmstudio(true);

    // Create LM Studio provider configuration
    const lmstudioProvider = {
      id: "lmstudio",
      name: "LM Studio (Local)",
      lmstudioUrl: lmstudioResult.url,
      apiKey: "",
      projectId: "",
      watsonxUrl: "",
      selectedModel:
        lmstudioResult.models.find((m) => !m.id.toLowerCase().includes("embed")) || null,
      selectedEmbeddingModel:
        lmstudioResult.models.find((m) => m.id.toLowerCase().includes("embed")) || null,
    };

    // Fetch full models list with metadata before saving
    let providerToSave = lmstudioProvider;
    try {
      providerToSave = await fetchAndUpdateProviderModels(lmstudioProvider);
    } catch (error) {
      console.warn("Failed to fetch LM Studio models, using basic config:", error);
    }

    // Update settings with the new provider
    const updatedProviders = [...(settings.providers || []), providerToSave];
    const updates = {
      providers: updatedProviders,
    };
    // Only set default provider if not already set
    if (!settings.defaultProviderId) {
      updates.defaultProviderId = "lmstudio";
    }
    await updateAndSaveSettings(updates);

    // Add a small delay for better UX, then transition
    // Keep isSettingUpLmstudio true until after transition completes to avoid glitch
    setTimeout(() => {
      transitionToStep(STEPS.BACKUP);
      // Reset after transition animation completes
      setTimeout(() => {
        setIsSettingUpLmstudio(false);
      }, TRANSITION_DURATION);
    }, 800);
  };

  const handleMaybeLaterLmstudio = () => {
    transitionToStep(STEPS.BACKUP);
  };

  const handleImportBackup = () => {
    setImportError(null);
    importFullBackup({
      onStart: () => {
        setIsImporting(true);
      },
      onSuccess: () => {
        transitionToStep(STEPS.COMPLETE);
        // Reset after transition animation completes
        setTimeout(() => {
          setIsImporting(false);
        }, TRANSITION_DURATION);
      },
      onError: (error) => {
        setImportError(error || "Failed to import backup");
        setIsImporting(false);
      },
    });
  };

  const handleStartFresh = () => {
    transitionToStep(STEPS.COMPLETE);
  };

  const handleComplete = () => {
    setIsExiting(true);
    // Wait for exit animation to complete before closing
    setTimeout(() => {
      onClose();
    }, 1600); // Match the CSS animation duration
  };

  const getAnimation = () => {
    switch (step) {
      case STEPS.WELCOME:
        return welcomeAnimation;
      case STEPS.OLLAMA_CHECK:
      case STEPS.LMSTUDIO_CHECK:
        return null; // No animation during system check
      case STEPS.OLLAMA_FOUND:
      case STEPS.OLLAMA_SETUP:
        return ollamaAnimation;
      case STEPS.LMSTUDIO_FOUND:
      case STEPS.LMSTUDIO_SETUP:
        return lmstudioAnimation;
      case STEPS.BACKUP:
        return backupAnimation;
      case STEPS.COMPLETE:
        return completeAnimation;
      default:
        return welcomeAnimation;
    }
  };

  const currentAnimation = getAnimation();

  const renderContent = () => {
    switch (step) {
      case STEPS.WELCOME:
        return (
          <Button kind="tertiary" size="lg" renderIcon={ChevronRight} onClick={handleStart}>
            Let's start
          </Button>
        );

      case STEPS.OLLAMA_CHECK:
        return <InlineLoading description="Checking your system..." />;

      case STEPS.OLLAMA_FOUND:
        return isSettingUpOllama ? (
          <InlineLoading description="Using local Ollama..." />
        ) : (
          <div className="welcome-modal__options">
            <p className="welcome-modal__message">
              <strong>Ollama</strong> found on your system, would you like to use it?
            </p>
            <div className="welcome-modal__buttons">
              <Button kind="tertiary" size="lg" onClick={handleMaybeLater}>
                Maybe later
              </Button>
              <Button kind="primary" size="lg" renderIcon={Checkmark} onClick={handleUseOllama}>
                Yes
              </Button>
            </div>
          </div>
        );

      case STEPS.LMSTUDIO_CHECK:
        return <InlineLoading description="Checking your system..." />;

      case STEPS.LMSTUDIO_FOUND:
        return isSettingUpLmstudio ? (
          <InlineLoading description="Using local LM Studio..." />
        ) : (
          <div className="welcome-modal__options">
            <p className="welcome-modal__message">
              <strong>LM Studio</strong> found on your system, would you like to use it?
            </p>
            <div className="welcome-modal__buttons">
              <Button kind="tertiary" size="lg" onClick={handleMaybeLaterLmstudio}>
                Maybe later
              </Button>
              <Button kind="primary" size="lg" renderIcon={Checkmark} onClick={handleUseLmstudio}>
                Yes
              </Button>
            </div>
          </div>
        );

      case STEPS.BACKUP:
        if (isImporting) {
          return <InlineLoading description="Importing backup..." />;
        }
        if (importError) {
          return (
            <div className="welcome-modal__options">
              <InlineLoading status="error" description={importError} />
              <div className="welcome-modal__buttons">
                <Button kind="tertiary" size="lg" onClick={handleStartFresh}>
                  Skip
                </Button>
                <Button kind="primary" size="lg" onClick={handleImportBackup}>
                  Retry
                </Button>
              </div>
            </div>
          );
        }
        return (
          <div className="welcome-modal__options">
            <p className="welcome-modal__message">Would you like to import a backup?</p>
            <div className="welcome-modal__buttons">
              <Button kind="tertiary" size="lg" onClick={handleStartFresh}>
                Not now
              </Button>
              <Button kind="primary" size="lg" renderIcon={Upload} onClick={handleImportBackup}>
                Import backup
              </Button>
            </div>
          </div>
        );

      case STEPS.COMPLETE:
        return (
          <Button kind="tertiary" size="lg" renderIcon={ChevronRight} onClick={handleComplete}>
            All set up, let's go
          </Button>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      open={isOpen}
      onRequestClose={() => {}}
      modalHeading="Welcome to RPI"
      passiveModal
      size="lg"
      className="welcome-modal"
      preventCloseOnClickOutside={true}
    >
      <div className="welcome-modal__body">
        <div
          className={`welcome-modal__animation welcome-modal__animation--${step} ${isExiting ? "fly-away" : ""} ${hasTransitioned ? (isTransitioning ? "fade-out" : "fade-in") : ""}`}
        >
          {currentAnimation && (
            <Lottie
              key={step}
              lottieRef={lottieRef}
              animationData={currentAnimation}
              loop={true}
              autoplay={true}
            />
          )}
        </div>

        <div
          key={step}
          className={`welcome-modal__content ${isExiting ? "fly-away" : ""} ${hasTransitioned ? (isTransitioning ? "fade-out" : "fade-in") : ""}`}
        >
          {renderContent()}
        </div>
      </div>
    </Modal>
  );
};

export default WelcomeModal;
