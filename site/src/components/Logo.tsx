import { useColorMode } from "@docusaurus/theme-common";
import DarkLogo from "@site/static/img/logo-dark.svg";
import LightLogo from "@site/static/img/logo-light.svg";
import React from "react";

export const Logo: React.FC = () => {
  const { isDarkTheme } = useColorMode();

  return isDarkTheme ? <DarkLogo /> : <LightLogo />;
};
