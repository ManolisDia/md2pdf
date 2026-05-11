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

/**
 * Insert text at the current cursor position, surrounded by newlines so
 * it ends up on its own block-level line. Used for the page-break button.
 */
export function insertBlockAtCursor(view: EditorView, text: string): void {
  const sel = view.state.selection.main;
  const doc = view.state.doc;
  const lineAt = doc.lineAt(sel.from);
  const atLineStart = sel.from === lineAt.from;
  const atLineEnd = sel.from === lineAt.to;
  const before = atLineStart ? "" : "\n\n";
  const after = atLineEnd ? "\n\n" : "\n\n";
  const insert = `${before}${text}${after}`;
  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert },
    selection: { anchor: sel.from + insert.length },
  });
  view.focus();
}
