import { createEditor } from "./editor.js";
import type { EditorView } from "@codemirror/view";

export interface SidebarHandles {
  configEditor: EditorView;
  toggle(): void;
}

export function mountSidebar(
  configHost: HTMLElement,
  initialYaml: string,
  onChange: (yaml: string) => void,
): SidebarHandles {
  const view = createEditor({
    parent: configHost,
    initial: initialYaml,
    language: "yaml",
    onChange,
  });

  const toggleBtn = document.getElementById("toggle-config")!;
  const main = document.querySelector(".app-main")!;
  toggleBtn.addEventListener("click", () => {
    main.classList.toggle("sidebar-collapsed");
  });

  return {
    configEditor: view,
    toggle() {
      main.classList.toggle("sidebar-collapsed");
    },
  };
}
