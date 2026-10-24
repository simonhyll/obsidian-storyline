/**
 * Configuration for scaffolding a new StoryLine project.
 */
export interface ProjectConfig {
  /** Project title */
  title: string;
  /** Genre of the story */
  genre?: string;
  /** Narrative structure to use for beat sheets */
  structure?: string;
  /** Number of acts or chapters */
  acts?: number;
}

/**
 * A generated template file.
 */
export interface TemplateFile {
  /** Relative path of the file */
  path: string;
  /** Content of the template file */
  content: string;
}

/**
 * Result of a project scaffold operation.
 */
export interface ScaffoldResult {
  /** Generated template files */
  files: TemplateFile[];
  /** Project title */
  title: string;
}

/**
 * Storyliner for scaffolding new StoryLine projects.
 */
export class Storyliner {
  /**
   * Scaffold a new StoryLine project from a description.
   * @param config - Project configuration
   * @returns A result object with generated template files
   */
  async scaffold(config: ProjectConfig): Promise<ScaffoldResult> {
    const files: TemplateFile[] = [];

    // Scaffolding logic will be implemented here

    return {
      files,
      title: config.title,
    };
  }
}
