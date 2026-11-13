/**
 * Add-host page (design auth/AddHost): one page with a 直连 | 通过中继
 * switch over the existing direct and relay sign-in forms.
 *
 * The forms keep their own routes, so /login/direct and /login/relay?u=&r=
 * deep links keep working: the route seeds the segment, and switching the
 * segment navigates to the other form. Neither form's logic changes here.
 */

import { useNavigate } from "react-router-dom";
import { Segmented, type SegmentedOption } from "../components/garden";
import { useI18n } from "../i18n";

export type AddHostMode = "direct" | "relay";

const MODE_PATH: Record<AddHostMode, string> = {
  direct: "/login/direct",
  relay: "/login/relay",
};

/** The connection-method switch drawn above either sign-in form. */
export function AddHostModeSwitch({ mode }: { mode: AddHostMode }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const options: readonly SegmentedOption<AddHostMode>[] = [
    { value: "direct", label: t("addHostModeDirect") },
    { value: "relay", label: t("addHostModeRelay") },
  ];
  return (
    <Segmented
      label={t("addHostModeLabel")}
      options={options}
      value={mode}
      block
      onChange={(next) => {
        if (next !== mode) navigate(MODE_PATH[next], { replace: true });
      }}
    />
  );
}
