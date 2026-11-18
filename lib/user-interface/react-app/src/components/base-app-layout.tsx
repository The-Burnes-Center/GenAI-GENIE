import { AppLayout, AppLayoutProps } from "@cloudscape-design/components";
import { useNavigationPanelState } from "../common/hooks/use-navigation-panel-state";
import NavigationPanel from "./navigation-panel";
import { ReactElement, useState } from "react";
import {SessionRefreshContext} from "../common/session-refresh-context"

export default function BaseAppLayout(
  props: AppLayoutProps & { info?: ReactElement }
) {
  const [navigationPanelState, setNavigationPanelState] =
    useNavigationPanelState();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(true);

  return (
    <SessionRefreshContext.Provider value={{needsRefresh,setNeedsRefresh}}>
    <AppLayout
      headerSelector="#awsui-top-navigation"
      ariaLabels={{
        navigation: "Side navigation",
        navigationToggle: "Open side navigation",
        navigationClose: "Close side navigation",
        tools: "Help panel",
        toolsToggle: "Open help panel",
        toolsClose: "Close help panel",
      }}
      navigation={<NavigationPanel />}
      navigationOpen={!navigationPanelState.collapsed}
      onNavigationChange={({ detail }) =>
        setNavigationPanelState({ collapsed: !detail.open })
      }
      toolsHide={props.info === undefined ? true : false}
      tools={props.info}
      toolsOpen={toolsOpen}
      onToolsChange={({ detail }) => setToolsOpen(detail.open)}
      {...props}
    />
    </SessionRefreshContext.Provider>
  );
}
