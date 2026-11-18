import {
  ButtonDropdownProps,
  TopNavigation,
} from "@cloudscape-design/components";
import { Mode } from "@cloudscape-design/global-styles";
import { useEffect, useState } from "react";
import { StorageHelper } from "../common/helpers/storage-helper";
import { Auth } from "@aws-amplify/auth";
import useOnFollow from "../common/hooks/use-on-follow";
import { CHATBOT_NAME } from "../common/constants";

const MOON_ICON = (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
    <path
      d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

const SUN_ICON = (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
    <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
    </g>
  </svg>
);

export default function GlobalHeader({theme, setTheme}) {
  const onFollow = useOnFollow();
  // possibel change here
  const [userName, setUserName] = useState<string | null>(null);


  useEffect(() => {
    (async () => {
      const result = await Auth.currentAuthenticatedUser();

      if (!result || Object.keys(result).length === 0) {
        Auth.signOut();
        return;
      }

      const userName = result?.signInUserSession?.idToken?.payload?.email;
      setUserName(userName);
    })();
  }, []);

  const onChangeThemeClick = () => {
    if (theme === Mode.Dark) {
      setTheme(StorageHelper.applyTheme(Mode.Light));
    } else {
      setTheme(StorageHelper.applyTheme(Mode.Dark));
    }
  };

  const onUserProfileClick = ({
    detail,
  }: {
    detail: ButtonDropdownProps.ItemClickDetails;
  }) => {
    if (detail.id === "signout") {
      Auth.signOut();
    }
  };

  return (
    <div
      style={{ zIndex: 1002, top: 0, left: 0, right: 0, position: "fixed" }}
      id="awsui-top-navigation"
    >
      <TopNavigation
        identity={{
          href: "/",
          title: "EOTSS GENIE" ,
          logo: { src: "/images/stateseal-color.png", alt: CHATBOT_NAME + " logo" },
        }}
        utilities={[
          {
            type: "button",
            text: theme === Mode.Dark ? "Light mode" : "Dark mode",
            ariaLabel: theme === Mode.Dark ? "Switch to light mode" : "Switch to dark mode",
            iconSvg: theme === Mode.Dark ? SUN_ICON : MOON_ICON,
            onClick: onChangeThemeClick,
          },
          {
            type: "menu-dropdown",
            description: userName ?? "",
            iconName: "user-profile",
            ariaLabel: "Account menu",
            title: "Account",
            onItemClick: onUserProfileClick,
            items: [
              {
                id: "signout",
                text: "Sign out",
              },
              {
                id: "username",
                text: "Email: " + userName

              }
            ],
            onItemFollow: onFollow,
          },
        ]}
      />
    </div>
  );
}
