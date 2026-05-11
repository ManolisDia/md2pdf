declare module "pagedjs" {
  export class Previewer {
    preview(
      content: string | HTMLElement,
      stylesheets?: Array<string | HTMLStyleElement | HTMLLinkElement>,
      renderTo?: HTMLElement,
    ): Promise<unknown>;
  }
}
