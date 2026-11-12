import { useEffect, useState } from "react";
import {
  Authenticator,
  ThemeProvider,
  defaultDarkModeOverride,
} from "@aws-amplify/ui-react";
import App from "../app";
import { Amplify } from "aws-amplify";
import { AppConfig } from "../common/types";
import { AppContext } from "../common/app-context";
import { Alert, StatusIndicator } from "@cloudscape-design/components";
import { StorageHelper } from "../common/helpers/storage-helper";
import { Mode } from "@cloudscape-design/global-styles";
import "@aws-amplify/ui-react/styles.css";

const centeredStyle = {
  width: "100%",
  height: "100%",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};

export default function AppConfigured() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [hasConfigError, setHasConfigError] = useState(false);
  const [theme, setTheme] = useState(StorageHelper.getTheme());

  // load the deploy-time config and point Amplify at the stack's user pool
  useEffect(() => {
    (async () => {
      try {
        const result = await fetch("/aws-exports.json");
        const awsExports = await result.json();
        Amplify.configure(awsExports);
        setConfig(awsExports);
      } catch (e) {
        console.error("Error loading /aws-exports.json:", e);
        setHasConfigError(true);
      }
    })();
  }, []);

  // dark/light theme
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "style"
        ) {
          const newValue =
            document.documentElement.style.getPropertyValue(
              "--app-color-scheme"
            );

          const mode = newValue === "dark" ? Mode.Dark : Mode.Light;
          if (mode !== theme) {
            setTheme(mode);
          }
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"],
    });

    return () => {
      observer.disconnect();
    };
  }, [theme]);

  if (hasConfigError) {
    return (
      <div style={centeredStyle}>
        <Alert header="Configuration error" type="error">
          Could not load the app configuration from{" "}
          <a href="/aws-exports.json" style={{ fontWeight: "600" }}>
            /aws-exports.json
          </a>
          .
        </Alert>
      </div>
    );
  }

  if (!config) {
    return (
      <div style={centeredStyle}>
        <StatusIndicator type="loading">Loading</StatusIndicator>
      </div>
    );
  }

  // users are created by an admin (self sign-up is off), so hide the sign-up tab
  return (
    <AppContext.Provider value={config}>
      <ThemeProvider
        theme={{
          name: "default-theme",
          overrides: [defaultDarkModeOverride],
        }}
        colorMode={theme === Mode.Dark ? "dark" : "light"}
      >
        <Authenticator hideSignUp loginMechanisms={["email"]}>
          <App />
        </Authenticator>
      </ThemeProvider>
    </AppContext.Provider>
  );
}
