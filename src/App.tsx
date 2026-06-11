import { useEffect } from "react";
import { EditorWindow } from "./components/EditorWindow";
import { FourPanelLayout } from "./components/layout/FourPanelLayout";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { useShortcuts } from "./hooks/useShortcuts";
import { useAutoGit } from "./hooks/useAutoGit";
import { editorWindowNote } from "./lib/windows";
import { useVault } from "./store/vaultStore";

export default function App() {
  const booted = useVault((s) => s.booted);
  const vaultPath = useVault((s) => s.settings.vaultPath);
  const zoom = useVault((s) => s.settings.zoom);
  const init = useVault((s) => s.init);
  const secondaryNote = editorWindowNote();

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    (document.body.style as CSSStyleDeclaration & { zoom: string }).zoom =
      String(zoom ?? 1);
  }, [zoom]);

  if (!booted) return null;
  if (secondaryNote) return <EditorWindow path={secondaryNote} />;
  if (!vaultPath) return <WelcomeScreen />;
  return <MainWindow />;
}

function MainWindow() {
  useShortcuts();
  useAutoGit();
  return <FourPanelLayout />;
}
