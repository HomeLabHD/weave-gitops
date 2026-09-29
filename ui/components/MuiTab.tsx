import { Tab } from "@mui/material";
import * as React from "react";
import styled from "styled-components";
import Text from "./Text";

type Props = {
  className?: string;
  active?: boolean;
  component?: any;
  to?: string;
  text: string;
  onClick?: any;
  // MUI <Tabs> injects props (value, selected, indicator, fullWidth, textColor, …)
  // and a ref into each child; they are forwarded through ...rest so the underlying
  // <Tab> and MUI 9's roving-tabindex receive them.
  [key: string]: any;
};

const MuiTab = React.forwardRef<HTMLDivElement, Props>(function MuiTab(
  { className, active, text, ...rest },
  ref,
) {
  return (
    <Tab
      ref={ref}
      className={`${className ?? ""}${active ? " active-tab" : ""}`}
      label={
        <Text
          size="small"
          uppercase
          bold={active}
          semiBold={active}
          color={active ? "primary10" : "neutral30"}
        >
          {text}
        </Text>
      }
      {...rest}
    />
  );
});

MuiTab.displayName = "MuiTab";

export default styled(MuiTab).attrs({ className: MuiTab.displayName })`
  &.active-tab {
    background: ${(props) => props.theme.colors.primary}19;
  }
`;
