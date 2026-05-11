export interface StyleConfig {
  page: {
    size: "A4" | "Letter" | "Legal";
    margin: string;
  };
  fonts: {
    body: string;
    headings: string;
    mono: string;
    base_size: string;
  };
  colors: {
    text: string;
    headings: string;
    link: string;
    accent: string;
    code_bg: string;
    rule: string;
  };
  spacing: {
    line_height: number;
    paragraph: string;
    heading_top: string;
    max_width: string;
  };
  theme:
    | "academic"
    | "minimal"
    | "technical"
    | "elegant"
    | "github"
    | "newspaper"
    | "terminal"
    | "pastel"
    | "whitepaper"
    | "magazine";
  dark: boolean;
  custom_css?: string | null;
}

export interface RenderRequest {
  markdown: string;
  config?: Partial<StyleConfig>;
}

export interface RenderResponse {
  html: string;
  frontmatter: Record<string, unknown>;
}
