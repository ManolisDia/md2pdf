import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { yaml } from "@codemirror/lang-yaml";

export interface CreateEditorOptions {
  parent: HTMLElement;
  initial: string;
  language: "markdown" | "yaml";
  onChange?: (value: string) => void;
}

export function createEditor(opts: CreateEditorOptions): EditorView {
  const langExt = opts.language === "yaml" ? yaml() : markdown();
  const updateListener = EditorView.updateListener.of((u) => {
    if (u.docChanged && opts.onChange) {
      opts.onChange(u.state.doc.toString());
    }
  });
  return new EditorView({
    parent: opts.parent,
    state: EditorState.create({
      doc: opts.initial,
      extensions: [
        basicSetup,
        langExt,
        updateListener,
        EditorView.lineWrapping,
      ],
    }),
  });
}

export function setEditorValue(view: EditorView, value: string): void {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: value },
  });
}
