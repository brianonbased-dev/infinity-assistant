/**
 * Documentation Generator Service
 *
 * Auto-generates README files, API documentation, component docs,
 * changelog entries, and maintains documentation consistency.
 */

// ============================================================================
// Types
// ============================================================================

export interface Documentation {
  id: string;
  projectId: string;
  type: DocumentationType;
  title: string;
  content: string;
  format: 'markdown' | 'html' | 'json' | 'openapi';
  sections: DocumentationSection[];
  metadata: DocumentationMetadata;
  status: 'draft' | 'published' | 'outdated';
  version: string;
  generatedAt: Date;
  updatedAt: Date;
}

export type DocumentationType =
  | 'readme'
  | 'api'
  | 'component'
  | 'changelog'
  | 'contributing'
  | 'architecture'
  | 'deployment'
  | 'user-guide'
  | 'developer-guide';

export interface DocumentationSection {
  id: string;
  title: string;
  content: string;
  order: number;
  level: number;
  children?: DocumentationSection[];
}

export interface DocumentationMetadata {
  author?: string;
  contributors?: string[];
  lastReviewed?: Date;
  tags?: string[];
  relatedDocs?: string[];
  sourceFiles?: string[];
}

// Code analysis types
export interface CodeAnalysis {
  files: AnalyzedFile[];
  functions: AnalyzedFunction[];
  classes: AnalyzedClass[];
  components: AnalyzedComponent[];
  apis: AnalyzedAPI[];
  types: AnalyzedType[];
  dependencies: AnalyzedDependency[];
}

export interface AnalyzedFile {
  path: string;
  language: string;
  lines: number;
  imports: string[];
  exports: string[];
  description?: string;
}

export interface AnalyzedFunction {
  name: string;
  file: string;
  line: number;
  params: FunctionParam[];
  returnType?: string;
  description?: string;
  examples?: string[];
  isAsync: boolean;
  isExported: boolean;
}

export interface FunctionParam {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
  description?: string;
}

export interface AnalyzedClass {
  name: string;
  file: string;
  line: number;
  description?: string;
  extends?: string;
  implements?: string[];
  properties: ClassProperty[];
  methods: AnalyzedFunction[];
  isExported: boolean;
}

export interface ClassProperty {
  name: string;
  type: string;
  visibility: 'public' | 'private' | 'protected';
  description?: string;
  defaultValue?: string;
}

export interface AnalyzedComponent {
  name: string;
  file: string;
  line: number;
  type: 'functional' | 'class';
  props: ComponentProp[];
  description?: string;
  examples?: string[];
  isExported: boolean;
}

export interface ComponentProp {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
  description?: string;
}

export interface AnalyzedAPI {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  file: string;
  handler: string;
  description?: string;
  params?: APIParam[];
  queryParams?: APIParam[];
  body?: APIBodySchema;
  responses: APIResponse[];
  auth?: 'none' | 'bearer' | 'api-key' | 'basic';
}

export interface APIParam {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  example?: string;
}

export interface APIBodySchema {
  contentType: string;
  schema: Record<string, unknown>;
  example?: unknown;
}

export interface APIResponse {
  status: number;
  description: string;
  schema?: Record<string, unknown>;
  example?: unknown;
}

export interface AnalyzedType {
  name: string;
  file: string;
  line: number;
  kind: 'interface' | 'type' | 'enum';
  description?: string;
  properties?: TypeProperty[];
  values?: string[]; // For enums
  isExported: boolean;
}

export interface TypeProperty {
  name: string;
  type: string;
  optional: boolean;
  description?: string;
}

export interface AnalyzedDependency {
  name: string;
  version: string;
  type: 'runtime' | 'dev' | 'peer' | 'optional';
  description?: string;
  homepage?: string;
}

// Generation request types
export interface ReadmeGenerationRequest {
  projectId: string;
  projectName: string;
  description: string;
  features?: string[];
  installation?: string;
  usage?: string;
  techStack?: string[];
  license?: string;
  badges?: BadgeConfig[];
  includeTableOfContents?: boolean;
  includeLicenseSection?: boolean;
  includeContributingSection?: boolean;
}

export interface BadgeConfig {
  type: 'npm' | 'build' | 'coverage' | 'license' | 'version' | 'downloads' | 'custom';
  label?: string;
  value?: string;
  url?: string;
  color?: string;
}

export interface APIDocGenerationRequest {
  projectId: string;
  title: string;
  version: string;
  description?: string;
  servers?: { url: string; description: string }[];
  apis: AnalyzedAPI[];
  outputFormat: 'markdown' | 'openapi' | 'html';
}

export interface ComponentDocGenerationRequest {
  projectId: string;
  components: AnalyzedComponent[];
  includeExamples?: boolean;
  includeProps?: boolean;
  includeUsage?: boolean;
}

export interface ChangelogEntry {
  version: string;
  date: Date;
  changes: {
    type: 'added' | 'changed' | 'deprecated' | 'removed' | 'fixed' | 'security';
    description: string;
    issue?: string;
    pr?: string;
  }[];
}

// ============================================================================
// Code Analyzer
// ============================================================================

class CodeAnalyzer {
  /**
   * Analyze TypeScript/JavaScript code for documentation
   */
  analyzeCode(code: string, filePath: string): Partial<CodeAnalysis> {
    const analysis: Partial<CodeAnalysis> = {
      functions: [],
      classes: [],
      components: [],
      types: [],
      apis: []
    };

    // Extract functions
    const functionMatches = code.matchAll(
      /(?:\/\*\*[\s\S]*?\*\/\s*)?(export\s+)?(async\s+)?function\s+(\w+)\s*(<[^>]*>)?\s*\(([^)]*)\)\s*(?::\s*([^{]+))?\s*\{/g
    );

    for (const match of functionMatches) {
      const [, isExported, isAsync, name, , params, returnType] = match;
      const jsDoc = this.extractJSDoc(code, match.index || 0);

      analysis.functions!.push({
        name,
        file: filePath,
        line: this.getLineNumber(code, match.index || 0),
        params: this.parseParams(params),
        returnType: returnType?.trim(),
        description: jsDoc?.description,
        examples: jsDoc?.examples,
        isAsync: !!isAsync,
        isExported: !!isExported
      });
    }

    // Extract arrow functions
    const arrowMatches = code.matchAll(
      /(?:\/\*\*[\s\S]*?\*\/\s*)?(export\s+)?(const|let)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(async\s+)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>/g
    );

    for (const match of arrowMatches) {
      const [, isExported, , name, isAsync] = match;
      const jsDoc = this.extractJSDoc(code, match.index || 0);

      analysis.functions!.push({
        name,
        file: filePath,
        line: this.getLineNumber(code, match.index || 0),
        params: [],
        description: jsDoc?.description,
        isAsync: !!isAsync,
        isExported: !!isExported
      });
    }

    // Extract classes
    const classMatches = code.matchAll(
      /(?:\/\*\*[\s\S]*?\*\/\s*)?(export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?\s*\{/g
    );

    for (const match of classMatches) {
      const [, isExported, name, extendsClass, implementsInterfaces] = match;
      const jsDoc = this.extractJSDoc(code, match.index || 0);

      analysis.classes!.push({
        name,
        file: filePath,
        line: this.getLineNumber(code, match.index || 0),
        description: jsDoc?.description,
        extends: extendsClass,
        implements: implementsInterfaces?.split(',').map(i => i.trim()),
        properties: [],
        methods: [],
        isExported: !!isExported
      });
    }

    // Extract React components
    const componentMatches = code.matchAll(
      /(?:\/\*\*[\s\S]*?\*\/\s*)?(export\s+)?(const|function)\s+(\w+)\s*(?::\s*(?:React\.)?FC[^=]*)?[=\s]+(?:\([^)]*\)|function[^(]*\([^)]*\))\s*(?::\s*[^{=]+)?\s*(?:=>)?\s*(?:\{|<)/g
    );

    for (const match of componentMatches) {
      const [, isExported, , name] = match;
      const jsDoc = this.extractJSDoc(code, match.index || 0);

      // Check if it returns JSX (simple heuristic)
      const afterMatch = code.slice((match.index || 0) + match[0].length, (match.index || 0) + match[0].length + 500);
      if (afterMatch.includes('return') && (afterMatch.includes('<') || afterMatch.includes('jsx'))) {
        analysis.components!.push({
          name,
          file: filePath,
          line: this.getLineNumber(code, match.index || 0),
          type: 'functional',
          props: this.extractComponentProps(code, match.index || 0),
          description: jsDoc?.description,
          examples: jsDoc?.examples,
          isExported: !!isExported
        });
      }
    }

    // Extract interfaces and types
    const typeMatches = code.matchAll(
      /(?:\/\*\*[\s\S]*?\*\/\s*)?(export\s+)?(interface|type)\s+(\w+)(?:<[^>]*>)?\s*(?:=\s*)?(\{[^}]*\}|[^;{]+)/g
    );

    for (const match of typeMatches) {
      const [, isExported, kind, name, body] = match;
      const jsDoc = this.extractJSDoc(code, match.index || 0);

      analysis.types!.push({
        name,
        file: filePath,
        line: this.getLineNumber(code, match.index || 0),
        kind: kind as 'interface' | 'type',
        description: jsDoc?.description,
        properties: kind === 'interface' ? this.parseTypeProperties(body) : undefined,
        isExported: !!isExported
      });
    }

    // Extract API routes (Next.js style)
    const apiMatches = code.matchAll(
      /(GET|POST|PUT|DELETE|PATCH)\s*(?:=\s*async)?\s*(?:function)?\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/gi
    );

    for (const match of apiMatches) {
      const [, method] = match;
      const jsDoc = this.extractJSDoc(code, match.index || 0);

      analysis.apis!.push({
        method: method.toUpperCase() as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
        path: this.inferAPIPath(filePath),
        file: filePath,
        handler: method.toUpperCase(),
        description: jsDoc?.description,
        responses: [{ status: 200, description: 'Success' }]
      });
    }

    return analysis;
  }

  private extractJSDoc(code: string, position: number): { description?: string; examples?: string[] } | null {
    // Look backwards for JSDoc comment
    const beforeCode = code.slice(Math.max(0, position - 500), position);
    const jsDocMatch = beforeCode.match(/\/\*\*([\s\S]*?)\*\/\s*$/);

    if (!jsDocMatch) return null;

    const jsDoc = jsDocMatch[1];
    const lines = jsDoc.split('\n').map(l => l.replace(/^\s*\*\s?/, '').trim());

    // Extract description (lines before any @tag)
    const descLines = lines.filter(l => !l.startsWith('@') && l.length > 0);
    const description = descLines.join(' ');

    // Extract examples
    const examples: string[] = [];
    let inExample = false;
    let currentExample = '';

    for (const line of lines) {
      if (line.startsWith('@example')) {
        if (currentExample) examples.push(currentExample.trim());
        currentExample = '';
        inExample = true;
      } else if (line.startsWith('@') && inExample) {
        if (currentExample) examples.push(currentExample.trim());
        inExample = false;
        currentExample = '';
      } else if (inExample) {
        currentExample += line + '\n';
      }
    }
    if (currentExample) examples.push(currentExample.trim());

    return { description: description || undefined, examples: examples.length > 0 ? examples : undefined };
  }

  private parseParams(paramsStr: string): FunctionParam[] {
    if (!paramsStr.trim()) return [];

    return paramsStr.split(',').map(p => {
      const match = p.trim().match(/(\w+)(\?)?\s*(?::\s*(.+?))?(?:\s*=\s*(.+))?$/);
      if (!match) return { name: p.trim(), type: 'unknown', required: true };

      const [, name, optional, type, defaultValue] = match;
      return {
        name,
        type: type?.trim() || 'unknown',
        required: !optional && !defaultValue,
        defaultValue: defaultValue?.trim()
      };
    });
  }

  private parseTypeProperties(body: string): TypeProperty[] {
    const props: TypeProperty[] = [];
    const matches = body.matchAll(/(\w+)(\?)?\s*:\s*([^;,}]+)/g);

    for (const match of matches) {
      const [, name, optional, type] = match;
      props.push({
        name,
        type: type.trim(),
        optional: !!optional
      });
    }

    return props;
  }

  private extractComponentProps(code: string, position: number): ComponentProp[] {
    // Look for props interface/type near the component
    const nearbyCode = code.slice(Math.max(0, position - 1000), position);
    const propsMatch = nearbyCode.match(/interface\s+\w*Props\s*\{([^}]+)\}/);

    if (!propsMatch) return [];

    return this.parseTypeProperties(`{${propsMatch[1]}}`).map(p => ({
      name: p.name,
      type: p.type,
      required: !p.optional,
      description: p.description
    }));
  }

  private inferAPIPath(filePath: string): string {
    // Convert file path to API path (Next.js convention)
    const match = filePath.match(/app\/api\/(.+?)\/route\./);
    if (match) {
      return `/api/${match[1].replace(/\[([^\]]+)\]/g, ':$1')}`;
    }
    return '/api/unknown';
  }

  private getLineNumber(code: string, position: number): number {
    return code.slice(0, position).split('\n').length;
  }
}

// ============================================================================
// Documentation Generators
// ============================================================================

class ReadmeGenerator {
  generate(request: ReadmeGenerationRequest): string {
    const sections: string[] = [];

    // Title and badges
    sections.push(`# ${request.projectName}\n`);

    if (request.badges && request.badges.length > 0) {
      sections.push(this.generateBadges(request.badges) + '\n');
    }

    // Description
    sections.push(`${request.description}\n`);

    // Table of Contents
    if (request.includeTableOfContents) {
      sections.push(this.generateTableOfContents(request));
    }

    // Features
    if (request.features && request.features.length > 0) {
      sections.push('## Features\n');
      sections.push(request.features.map(f => `- ${f}`).join('\n') + '\n');
    }

    // Tech Stack
    if (request.techStack && request.techStack.length > 0) {
      sections.push('## Tech Stack\n');
      sections.push(request.techStack.map(t => `- ${t}`).join('\n') + '\n');
    }

    // Installation
    sections.push('## Installation\n');
    sections.push('```bash\n' + (request.installation || 'npm install\nnpm run dev') + '\n```\n');

    // Usage
    if (request.usage) {
      sections.push('## Usage\n');
      sections.push(request.usage + '\n');
    }

    // Contributing
    if (request.includeContributingSection) {
      sections.push('## Contributing\n');
      sections.push('Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.\n');
    }

    // License
    if (request.includeLicenseSection && request.license) {
      sections.push('## License\n');
      sections.push(`This project is licensed under the ${request.license} License - see the [LICENSE](LICENSE) file for details.\n`);
    }

    return sections.join('\n');
  }

  private generateBadges(badges: BadgeConfig[]): string {
    return badges.map(badge => {
      switch (badge.type) {
        case 'npm':
          return `[![npm version](https://badge.fury.io/js/${badge.value}.svg)](https://badge.fury.io/js/${badge.value})`;
        case 'build':
          return `![Build Status](https://github.com/${badge.value}/workflows/CI/badge.svg)`;
        case 'coverage':
          return `[![codecov](https://codecov.io/gh/${badge.value}/branch/main/graph/badge.svg)](https://codecov.io/gh/${badge.value})`;
        case 'license':
          return `[![License: ${badge.value}](https://img.shields.io/badge/License-${badge.value}-blue.svg)](LICENSE)`;
        case 'custom':
          return `![${badge.label}](https://img.shields.io/badge/${badge.label}-${badge.value}-${badge.color || 'blue'})`;
        default:
          return '';
      }
    }).filter(b => b).join(' ');
  }

  private generateTableOfContents(request: ReadmeGenerationRequest): string {
    const items: string[] = ['## Table of Contents\n'];

    if (request.features) items.push('- [Features](#features)');
    if (request.techStack) items.push('- [Tech Stack](#tech-stack)');
    items.push('- [Installation](#installation)');
    if (request.usage) items.push('- [Usage](#usage)');
    if (request.includeContributingSection) items.push('- [Contributing](#contributing)');
    if (request.includeLicenseSection) items.push('- [License](#license)');

    return items.join('\n') + '\n';
  }
}

class APIDocGenerator {
  generateMarkdown(request: APIDocGenerationRequest): string {
    const sections: string[] = [];

    sections.push(`# ${request.title}\n`);
    if (request.description) {
      sections.push(`${request.description}\n`);
    }
    sections.push(`**Version:** ${request.version}\n`);

    if (request.servers && request.servers.length > 0) {
      sections.push('## Servers\n');
      for (const server of request.servers) {
        sections.push(`- \`${server.url}\` - ${server.description}`);
      }
      sections.push('');
    }

    sections.push('## Endpoints\n');

    // Group by path
    const grouped = new Map<string, AnalyzedAPI[]>();
    for (const api of request.apis) {
      const existing = grouped.get(api.path) || [];
      existing.push(api);
      grouped.set(api.path, existing);
    }

    for (const [path, apis] of grouped) {
      sections.push(`### ${path}\n`);

      for (const api of apis) {
        sections.push(`#### \`${api.method}\` ${api.path}\n`);

        if (api.description) {
          sections.push(`${api.description}\n`);
        }

        if (api.auth && api.auth !== 'none') {
          sections.push(`**Authentication:** ${api.auth}\n`);
        }

        if (api.params && api.params.length > 0) {
          sections.push('**Path Parameters:**\n');
          sections.push('| Name | Type | Required | Description |');
          sections.push('|------|------|----------|-------------|');
          for (const param of api.params) {
            sections.push(`| \`${param.name}\` | ${param.type} | ${param.required ? 'Yes' : 'No'} | ${param.description || '-'} |`);
          }
          sections.push('');
        }

        if (api.queryParams && api.queryParams.length > 0) {
          sections.push('**Query Parameters:**\n');
          sections.push('| Name | Type | Required | Description |');
          sections.push('|------|------|----------|-------------|');
          for (const param of api.queryParams) {
            sections.push(`| \`${param.name}\` | ${param.type} | ${param.required ? 'Yes' : 'No'} | ${param.description || '-'} |`);
          }
          sections.push('');
        }

        if (api.body) {
          sections.push('**Request Body:**\n');
          sections.push(`Content-Type: \`${api.body.contentType}\`\n`);
          if (api.body.example) {
            sections.push('```json');
            sections.push(JSON.stringify(api.body.example, null, 2));
            sections.push('```\n');
          }
        }

        sections.push('**Responses:**\n');
        for (const response of api.responses) {
          sections.push(`- **${response.status}**: ${response.description}`);
          if (response.example) {
            sections.push('  ```json');
            sections.push('  ' + JSON.stringify(response.example, null, 2).split('\n').join('\n  '));
            sections.push('  ```');
          }
        }
        sections.push('');
      }
    }

    return sections.join('\n');
  }

  generateOpenAPI(request: APIDocGenerationRequest): Record<string, unknown> {
    const paths: Record<string, Record<string, unknown>> = {};

    for (const api of request.apis) {
      if (!paths[api.path]) {
        paths[api.path] = {};
      }

      const operation: Record<string, unknown> = {
        summary: api.description || `${api.method} ${api.path}`,
        responses: {}
      };

      if (api.params && api.params.length > 0) {
        operation.parameters = api.params.map(p => ({
          name: p.name,
          in: 'path',
          required: p.required,
          schema: { type: p.type },
          description: p.description
        }));
      }

      if (api.queryParams && api.queryParams.length > 0) {
        const params = (operation.parameters as Record<string, unknown>[]) || [];
        params.push(...api.queryParams.map(p => ({
          name: p.name,
          in: 'query',
          required: p.required,
          schema: { type: p.type },
          description: p.description
        })));
        operation.parameters = params;
      }

      if (api.body) {
        operation.requestBody = {
          content: {
            [api.body.contentType]: {
              schema: api.body.schema,
              example: api.body.example
            }
          }
        };
      }

      for (const response of api.responses) {
        (operation.responses as Record<string, unknown>)[response.status.toString()] = {
          description: response.description,
          content: response.example ? {
            'application/json': {
              example: response.example
            }
          } : undefined
        };
      }

      paths[api.path][api.method.toLowerCase()] = operation;
    }

    return {
      openapi: '3.0.3',
      info: {
        title: request.title,
        version: request.version,
        description: request.description
      },
      servers: request.servers,
      paths
    };
  }
}

class ComponentDocGenerator {
  generate(request: ComponentDocGenerationRequest): string {
    const sections: string[] = [];

    sections.push('# Component Documentation\n');

    for (const component of request.components) {
      sections.push(`## ${component.name}\n`);

      if (component.description) {
        sections.push(`${component.description}\n`);
      }

      sections.push(`**File:** \`${component.file}\`\n`);
      sections.push(`**Type:** ${component.type}\n`);

      if (request.includeProps && component.props.length > 0) {
        sections.push('### Props\n');
        sections.push('| Prop | Type | Required | Default | Description |');
        sections.push('|------|------|----------|---------|-------------|');

        for (const prop of component.props) {
          sections.push(`| \`${prop.name}\` | \`${prop.type}\` | ${prop.required ? 'Yes' : 'No'} | ${prop.defaultValue || '-'} | ${prop.description || '-'} |`);
        }
        sections.push('');
      }

      if (request.includeUsage) {
        sections.push('### Usage\n');
        sections.push('```tsx');
        sections.push(`import { ${component.name} } from '${component.file.replace(/\.(tsx?|jsx?)$/, '')}';`);
        sections.push('');
        sections.push(`<${component.name}`);
        for (const prop of component.props.filter(p => p.required)) {
          sections.push(`  ${prop.name}={/* ${prop.type} */}`);
        }
        sections.push('/>');
        sections.push('```\n');
      }

      if (request.includeExamples && component.examples) {
        sections.push('### Examples\n');
        for (const example of component.examples) {
          sections.push('```tsx');
          sections.push(example);
          sections.push('```\n');
        }
      }
    }

    return sections.join('\n');
  }
}

class ChangelogGenerator {
  generate(entries: ChangelogEntry[]): string {
    const sections: string[] = [];

    sections.push('# Changelog\n');
    sections.push('All notable changes to this project will be documented in this file.\n');
    sections.push('The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),');
    sections.push('and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n');

    // Sort entries by date descending
    const sortedEntries = [...entries].sort((a, b) => b.date.getTime() - a.date.getTime());

    for (const entry of sortedEntries) {
      const dateStr = entry.date.toISOString().split('T')[0];
      sections.push(`## [${entry.version}] - ${dateStr}\n`);

      // Group changes by type
      const byType = new Map<string, typeof entry.changes>();
      for (const change of entry.changes) {
        const existing = byType.get(change.type) || [];
        existing.push(change);
        byType.set(change.type, existing);
      }

      const typeOrder = ['added', 'changed', 'deprecated', 'removed', 'fixed', 'security'];

      for (const type of typeOrder) {
        const changes = byType.get(type);
        if (!changes || changes.length === 0) continue;

        sections.push(`### ${type.charAt(0).toUpperCase() + type.slice(1)}\n`);

        for (const change of changes) {
          let line = `- ${change.description}`;
          if (change.issue) line += ` ([#${change.issue}](issues/${change.issue}))`;
          if (change.pr) line += ` ([PR #${change.pr}](pulls/${change.pr}))`;
          sections.push(line);
        }
        sections.push('');
      }
    }

    return sections.join('\n');
  }

  addEntry(changelog: string, entry: ChangelogEntry): string {
    const newEntryContent = this.generate([entry]);
    // Extract just the version section
    const versionSection = newEntryContent.split('## [')[1];

    // Insert after the header
    const headerEnd = changelog.indexOf('## [');
    if (headerEnd === -1) {
      return changelog + '\n\n## [' + versionSection;
    }

    return changelog.slice(0, headerEnd) + '## [' + versionSection + '\n' + changelog.slice(headerEnd);
  }
}

// ============================================================================
// Main Service
// ============================================================================

type DocEvent = 'doc:generated' | 'doc:updated' | 'doc:published';
type EventHandler = (data: unknown) => void;

export class DocumentationGeneratorService {
  private static instance: DocumentationGeneratorService;
  private docs: Map<string, Documentation> = new Map();
  private codeAnalyzer: CodeAnalyzer;
  private readmeGenerator: ReadmeGenerator;
  private apiDocGenerator: APIDocGenerator;
  private componentDocGenerator: ComponentDocGenerator;
  private changelogGenerator: ChangelogGenerator;
  private eventHandlers: Map<DocEvent, EventHandler[]> = new Map();

  private constructor() {
    this.codeAnalyzer = new CodeAnalyzer();
    this.readmeGenerator = new ReadmeGenerator();
    this.apiDocGenerator = new APIDocGenerator();
    this.componentDocGenerator = new ComponentDocGenerator();
    this.changelogGenerator = new ChangelogGenerator();
  }

  static getInstance(): DocumentationGeneratorService {
    if (!DocumentationGeneratorService.instance) {
      DocumentationGeneratorService.instance = new DocumentationGeneratorService();
    }
    return DocumentationGeneratorService.instance;
  }

  // ---------------------------------------------------------------------------
  // Event System
  // ---------------------------------------------------------------------------

  subscribe(event: DocEvent, handler: EventHandler): () => void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);

    return () => {
      const idx = handlers.indexOf(handler);
      if (idx !== -1) handlers.splice(idx, 1);
    };
  }

  private emit(event: DocEvent, data: unknown): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => handler(data));
  }

  // ---------------------------------------------------------------------------
  // Code Analysis
  // ---------------------------------------------------------------------------

  analyzeCode(code: string, filePath: string): Partial<CodeAnalysis> {
    return this.codeAnalyzer.analyzeCode(code, filePath);
  }

  analyzeProject(files: { path: string; content: string }[]): CodeAnalysis {
    const analysis: CodeAnalysis = {
      files: [],
      functions: [],
      classes: [],
      components: [],
      apis: [],
      types: [],
      dependencies: []
    };

    for (const file of files) {
      const fileAnalysis = this.analyzeCode(file.content, file.path);

      analysis.files.push({
        path: file.path,
        language: this.getLanguage(file.path),
        lines: file.content.split('\n').length,
        imports: this.extractImports(file.content),
        exports: this.extractExports(file.content)
      });

      if (fileAnalysis.functions) analysis.functions.push(...fileAnalysis.functions);
      if (fileAnalysis.classes) analysis.classes.push(...fileAnalysis.classes);
      if (fileAnalysis.components) analysis.components.push(...fileAnalysis.components);
      if (fileAnalysis.apis) analysis.apis.push(...fileAnalysis.apis);
      if (fileAnalysis.types) analysis.types.push(...fileAnalysis.types);
    }

    return analysis;
  }

  private getLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      rs: 'rust',
      go: 'go'
    };
    return langMap[ext || ''] || 'unknown';
  }

  private extractImports(code: string): string[] {
    const imports: string[] = [];
    const matches = code.matchAll(/import\s+(?:[^;]+from\s+)?['"]([^'"]+)['"]/g);
    for (const match of matches) {
      imports.push(match[1]);
    }
    return imports;
  }

  private extractExports(code: string): string[] {
    const exports: string[] = [];
    const matches = code.matchAll(/export\s+(?:default\s+)?(?:const|function|class|interface|type)\s+(\w+)/g);
    for (const match of matches) {
      exports.push(match[1]);
    }
    return exports;
  }

  // ---------------------------------------------------------------------------
  // README Generation
  // ---------------------------------------------------------------------------

  async generateReadme(request: ReadmeGenerationRequest): Promise<Documentation> {
    const content = this.readmeGenerator.generate(request);

    const doc: Documentation = {
      id: `doc-${Date.now()}`,
      projectId: request.projectId,
      type: 'readme',
      title: 'README',
      content,
      format: 'markdown',
      sections: this.extractSections(content),
      metadata: { sourceFiles: ['README.md'] },
      status: 'draft',
      version: '1.0.0',
      generatedAt: new Date(),
      updatedAt: new Date()
    };

    this.docs.set(doc.id, doc);
    this.emit('doc:generated', doc);

    return doc;
  }

  // ---------------------------------------------------------------------------
  // API Documentation
  // ---------------------------------------------------------------------------

  async generateAPIDoc(request: APIDocGenerationRequest): Promise<Documentation> {
    const content = request.outputFormat === 'openapi'
      ? JSON.stringify(this.apiDocGenerator.generateOpenAPI(request), null, 2)
      : this.apiDocGenerator.generateMarkdown(request);

    const doc: Documentation = {
      id: `doc-${Date.now()}`,
      projectId: request.projectId,
      type: 'api',
      title: request.title,
      content,
      format: request.outputFormat === 'openapi' ? 'openapi' : 'markdown',
      sections: request.outputFormat !== 'openapi' ? this.extractSections(content) : [],
      metadata: { tags: ['api'], sourceFiles: request.apis.map(a => a.file) },
      status: 'draft',
      version: request.version,
      generatedAt: new Date(),
      updatedAt: new Date()
    };

    this.docs.set(doc.id, doc);
    this.emit('doc:generated', doc);

    return doc;
  }

  // ---------------------------------------------------------------------------
  // Component Documentation
  // ---------------------------------------------------------------------------

  async generateComponentDoc(request: ComponentDocGenerationRequest): Promise<Documentation> {
    const content = this.componentDocGenerator.generate(request);

    const doc: Documentation = {
      id: `doc-${Date.now()}`,
      projectId: request.projectId,
      type: 'component',
      title: 'Component Documentation',
      content,
      format: 'markdown',
      sections: this.extractSections(content),
      metadata: { tags: ['components'], sourceFiles: request.components.map(c => c.file) },
      status: 'draft',
      version: '1.0.0',
      generatedAt: new Date(),
      updatedAt: new Date()
    };

    this.docs.set(doc.id, doc);
    this.emit('doc:generated', doc);

    return doc;
  }

  // ---------------------------------------------------------------------------
  // Changelog
  // ---------------------------------------------------------------------------

  async generateChangelog(projectId: string, entries: ChangelogEntry[]): Promise<Documentation> {
    const content = this.changelogGenerator.generate(entries);

    const doc: Documentation = {
      id: `doc-${Date.now()}`,
      projectId,
      type: 'changelog',
      title: 'Changelog',
      content,
      format: 'markdown',
      sections: this.extractSections(content),
      metadata: { sourceFiles: ['CHANGELOG.md'] },
      status: 'draft',
      version: entries[0]?.version || '1.0.0',
      generatedAt: new Date(),
      updatedAt: new Date()
    };

    this.docs.set(doc.id, doc);
    this.emit('doc:generated', doc);

    return doc;
  }

  async addChangelogEntry(docId: string, entry: ChangelogEntry): Promise<Documentation> {
    const doc = this.docs.get(docId);
    if (!doc || doc.type !== 'changelog') {
      throw new Error('Changelog document not found');
    }

    doc.content = this.changelogGenerator.addEntry(doc.content, entry);
    doc.version = entry.version;
    doc.updatedAt = new Date();
    doc.sections = this.extractSections(doc.content);

    this.emit('doc:updated', doc);
    return doc;
  }

  // ---------------------------------------------------------------------------
  // Document Management
  // ---------------------------------------------------------------------------

  async getDoc(id: string): Promise<Documentation | undefined> {
    return this.docs.get(id);
  }

  async getDocsByProject(projectId: string): Promise<Documentation[]> {
    return Array.from(this.docs.values()).filter(d => d.projectId === projectId);
  }

  async getDocsByType(projectId: string, type: DocumentationType): Promise<Documentation[]> {
    return Array.from(this.docs.values()).filter(d => d.projectId === projectId && d.type === type);
  }

  async updateDoc(id: string, updates: Partial<Documentation>): Promise<Documentation | undefined> {
    const doc = this.docs.get(id);
    if (!doc) return undefined;

    const updated = { ...doc, ...updates, updatedAt: new Date() };
    if (updates.content) {
      updated.sections = this.extractSections(updates.content);
    }

    this.docs.set(id, updated);
    this.emit('doc:updated', updated);

    return updated;
  }

  async publishDoc(id: string): Promise<Documentation> {
    const doc = this.docs.get(id);
    if (!doc) throw new Error('Document not found');

    doc.status = 'published';
    doc.updatedAt = new Date();

    this.emit('doc:published', doc);
    return doc;
  }

  async deleteDoc(id: string): Promise<boolean> {
    return this.docs.delete(id);
  }

  // ---------------------------------------------------------------------------
  // Utility Methods
  // ---------------------------------------------------------------------------

  private extractSections(markdown: string): DocumentationSection[] {
    const sections: DocumentationSection[] = [];
    const lines = markdown.split('\n');
    let currentSection: DocumentationSection | null = null;
    let sectionContent: string[] = [];
    let order = 0;

    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headerMatch) {
        // Save previous section
        if (currentSection) {
          currentSection.content = sectionContent.join('\n').trim();
          sections.push(currentSection);
        }

        const level = headerMatch[1].length;
        currentSection = {
          id: `section-${order}`,
          title: headerMatch[2],
          content: '',
          order: order++,
          level
        };
        sectionContent = [];
      } else if (currentSection) {
        sectionContent.push(line);
      }
    }

    // Save last section
    if (currentSection) {
      currentSection.content = sectionContent.join('\n').trim();
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Generate documentation from project analysis
   */
  async generateFromAnalysis(
    projectId: string,
    projectName: string,
    analysis: CodeAnalysis
  ): Promise<{ readme: Documentation; api?: Documentation; components?: Documentation }> {
    const result: { readme: Documentation; api?: Documentation; components?: Documentation } = {
      readme: await this.generateReadme({
        projectId,
        projectName,
        description: `${projectName} - A modern application`,
        features: [
          `${analysis.functions.length} functions`,
          `${analysis.classes.length} classes`,
          `${analysis.components.length} React components`,
          `${analysis.apis.length} API endpoints`
        ],
        includeTableOfContents: true
      })
    };

    if (analysis.apis.length > 0) {
      result.api = await this.generateAPIDoc({
        projectId,
        title: `${projectName} API`,
        version: '1.0.0',
        apis: analysis.apis,
        outputFormat: 'markdown'
      });
    }

    if (analysis.components.length > 0) {
      result.components = await this.generateComponentDoc({
        projectId,
        components: analysis.components,
        includeProps: true,
        includeUsage: true,
        includeExamples: true
      });
    }

    return result;
  }
}

export default DocumentationGeneratorService;
