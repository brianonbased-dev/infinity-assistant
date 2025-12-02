/**
 * Test Generator Service
 *
 * Automatically generates comprehensive test suites including unit tests,
 * integration tests, and E2E tests based on code analysis.
 */

// =============================================================================
// TYPES
// =============================================================================

export type TestFramework = 'jest' | 'vitest' | 'mocha' | 'pytest' | 'go_test';
export type TestType = 'unit' | 'integration' | 'e2e' | 'snapshot' | 'performance';

export interface TestConfig {
  framework: TestFramework;
  language: 'typescript' | 'javascript' | 'python' | 'go';
  outputDir: string;
  coverageThreshold?: number;
  includeSnapshots?: boolean;
  mockExternals?: boolean;
}

export interface GeneratedTest {
  id: string;
  name: string;
  type: TestType;
  filePath: string;
  targetFile: string;
  targetFunction?: string;
  code: string;
  assertions: number;
  mocks: MockDefinition[];
  fixtures?: TestFixture[];
  createdAt: string;
}

export interface MockDefinition {
  name: string;
  module: string;
  type: 'function' | 'class' | 'module' | 'constant';
  implementation: string;
}

export interface TestFixture {
  name: string;
  data: unknown;
  description?: string;
}

export interface TestSuite {
  id: string;
  name: string;
  targetModule: string;
  tests: GeneratedTest[];
  setup?: string;
  teardown?: string;
  coverage?: CoverageReport;
  createdAt: string;
}

export interface CoverageReport {
  lines: number;
  statements: number;
  functions: number;
  branches: number;
  uncoveredLines: number[];
}

export interface CodeAnalysis {
  functions: FunctionInfo[];
  classes: ClassInfo[];
  imports: ImportInfo[];
  exports: ExportInfo[];
  dependencies: string[];
}

export interface FunctionInfo {
  name: string;
  params: ParamInfo[];
  returnType?: string;
  async: boolean;
  exported: boolean;
  complexity: number;
  lineStart: number;
  lineEnd: number;
}

export interface ParamInfo {
  name: string;
  type?: string;
  optional: boolean;
  defaultValue?: string;
}

export interface ClassInfo {
  name: string;
  methods: FunctionInfo[];
  properties: PropertyInfo[];
  constructor?: FunctionInfo;
  exported: boolean;
}

export interface PropertyInfo {
  name: string;
  type?: string;
  visibility: 'public' | 'private' | 'protected';
  readonly: boolean;
}

export interface ImportInfo {
  module: string;
  named: string[];
  default?: string;
  namespace?: string;
}

export interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'const' | 'default';
}

// =============================================================================
// CODE ANALYZER
// =============================================================================

class CodeAnalyzer {
  analyze(code: string, language: string): CodeAnalysis {
    switch (language) {
      case 'typescript':
      case 'javascript':
        return this.analyzeTypeScript(code);
      case 'python':
        return this.analyzePython(code);
      default:
        return this.analyzeGeneric(code);
    }
  }

  private analyzeTypeScript(code: string): CodeAnalysis {
    const functions: FunctionInfo[] = [];
    const classes: ClassInfo[] = [];
    const imports: ImportInfo[] = [];
    const exports: ExportInfo[] = [];
    const dependencies: string[] = [];

    // Parse imports
    const importRegex = /import\s+(?:(\*\s+as\s+(\w+))|(?:\{([^}]+)\})|(\w+))(?:\s*,\s*\{([^}]+)\})?\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(code)) !== null) {
      const module = match[6];
      const imp: ImportInfo = { module, named: [] };

      if (match[2]) {
        imp.namespace = match[2];
      }
      if (match[3]) {
        imp.named = match[3].split(',').map((s) => s.trim().split(' as ')[0]);
      }
      if (match[4]) {
        imp.default = match[4];
      }
      if (match[5]) {
        imp.named = match[5].split(',').map((s) => s.trim().split(' as ')[0]);
      }

      imports.push(imp);

      if (!module.startsWith('.') && !module.startsWith('@/')) {
        dependencies.push(module);
      }
    }

    // Parse exports
    const exportRegex = /export\s+(?:(default)\s+)?(?:(function|class|const|let|var)\s+)?(\w+)/g;
    while ((match = exportRegex.exec(code)) !== null) {
      exports.push({
        name: match[3],
        type: match[1] ? 'default' : (match[2] as 'function' | 'class' | 'const') || 'const',
      });
    }

    // Parse functions
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^\{]+))?\s*\{/g;
    while ((match = functionRegex.exec(code)) !== null) {
      const params = this.parseParams(match[2]);
      const isAsync = code.slice(match.index - 10, match.index).includes('async');
      const exported = code.slice(match.index - 10, match.index).includes('export');

      functions.push({
        name: match[1],
        params,
        returnType: match[3]?.trim(),
        async: isAsync,
        exported,
        complexity: this.calculateComplexity(code, match.index),
        lineStart: this.getLineNumber(code, match.index),
        lineEnd: this.getLineNumber(code, match.index + 100),
      });
    }

    // Parse arrow functions
    const arrowRegex = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)(?:\s*:\s*([^\=\>]+))?\s*=>/g;
    while ((match = arrowRegex.exec(code)) !== null) {
      const params = this.parseParams(match[2]);
      const isAsync = code.slice(match.index, match.index + 50).includes('async');
      const exported = code.slice(match.index - 10, match.index).includes('export');

      functions.push({
        name: match[1],
        params,
        returnType: match[3]?.trim(),
        async: isAsync,
        exported,
        complexity: this.calculateComplexity(code, match.index),
        lineStart: this.getLineNumber(code, match.index),
        lineEnd: this.getLineNumber(code, match.index + 100),
      });
    }

    // Parse classes
    const classRegex = /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?\s*\{/g;
    while ((match = classRegex.exec(code)) !== null) {
      const className = match[1];
      const classStart = match.index;
      const exported = code.slice(match.index - 10, match.index).includes('export');

      // Find class body
      let braceCount = 1;
      let i = code.indexOf('{', classStart) + 1;
      while (braceCount > 0 && i < code.length) {
        if (code[i] === '{') braceCount++;
        if (code[i] === '}') braceCount--;
        i++;
      }
      const classBody = code.slice(classStart, i);

      // Parse methods
      const methods: FunctionInfo[] = [];
      const methodRegex = /(?:async\s+)?(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^\{]+))?\s*\{/g;
      let methodMatch;
      while ((methodMatch = methodRegex.exec(classBody)) !== null) {
        if (methodMatch[1] !== 'constructor') {
          methods.push({
            name: methodMatch[1],
            params: this.parseParams(methodMatch[2]),
            returnType: methodMatch[3]?.trim(),
            async: classBody.slice(methodMatch.index - 10, methodMatch.index).includes('async'),
            exported: false,
            complexity: 1,
            lineStart: 0,
            lineEnd: 0,
          });
        }
      }

      classes.push({
        name: className,
        methods,
        properties: [],
        exported,
        constructor: undefined,
      });
    }

    return { functions, classes, imports, exports, dependencies };
  }

  private analyzePython(code: string): CodeAnalysis {
    const functions: FunctionInfo[] = [];
    const classes: ClassInfo[] = [];
    const imports: ImportInfo[] = [];
    const dependencies: string[] = [];

    // Parse imports
    const importRegex = /(?:from\s+(\S+)\s+)?import\s+([^#\n]+)/g;
    let match;
    while ((match = importRegex.exec(code)) !== null) {
      const module = match[1] || match[2].split(',')[0].trim();
      imports.push({
        module,
        named: match[2].split(',').map((s) => s.trim()),
      });

      if (!module.startsWith('.')) {
        dependencies.push(module.split('.')[0]);
      }
    }

    // Parse functions
    const functionRegex = /(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^\:]+))?\s*:/g;
    while ((match = functionRegex.exec(code)) !== null) {
      const params = this.parsePythonParams(match[2]);
      const isAsync = code.slice(match.index - 10, match.index).includes('async');

      functions.push({
        name: match[1],
        params,
        returnType: match[3]?.trim(),
        async: isAsync,
        exported: !match[1].startsWith('_'),
        complexity: 1,
        lineStart: this.getLineNumber(code, match.index),
        lineEnd: this.getLineNumber(code, match.index + 100),
      });
    }

    // Parse classes
    const classRegex = /class\s+(\w+)(?:\([^)]*\))?\s*:/g;
    while ((match = classRegex.exec(code)) !== null) {
      classes.push({
        name: match[1],
        methods: [],
        properties: [],
        exported: !match[1].startsWith('_'),
        constructor: undefined,
      });
    }

    return { functions, classes, imports, exports: [], dependencies };
  }

  private analyzeGeneric(code: string): CodeAnalysis {
    return {
      functions: [],
      classes: [],
      imports: [],
      exports: [],
      dependencies: [],
    };
  }

  private parseParams(paramsStr: string): ParamInfo[] {
    if (!paramsStr.trim()) return [];

    return paramsStr.split(',').map((p) => {
      const parts = p.trim().split(':');
      const nameAndDefault = parts[0].split('=');
      const name = nameAndDefault[0].replace(/[?]/g, '').trim();

      return {
        name,
        type: parts[1]?.trim(),
        optional: parts[0].includes('?') || nameAndDefault.length > 1,
        defaultValue: nameAndDefault[1]?.trim(),
      };
    });
  }

  private parsePythonParams(paramsStr: string): ParamInfo[] {
    if (!paramsStr.trim()) return [];

    return paramsStr
      .split(',')
      .filter((p) => !p.trim().startsWith('self'))
      .map((p) => {
        const parts = p.trim().split(':');
        const nameAndDefault = parts[0].split('=');

        return {
          name: nameAndDefault[0].trim(),
          type: parts[1]?.split('=')[0].trim(),
          optional: nameAndDefault.length > 1,
          defaultValue: nameAndDefault[1]?.trim() || parts[1]?.split('=')[1]?.trim(),
        };
      });
  }

  private calculateComplexity(code: string, startIndex: number): number {
    // Find function body and count decision points
    let braceCount = 0;
    let started = false;
    let complexity = 1;

    for (let i = startIndex; i < Math.min(startIndex + 2000, code.length); i++) {
      if (code[i] === '{') {
        braceCount++;
        started = true;
      }
      if (code[i] === '}') {
        braceCount--;
        if (started && braceCount === 0) break;
      }

      // Count decision points
      const keywords = ['if', 'else', 'for', 'while', 'case', '&&', '||', '?'];
      for (const kw of keywords) {
        if (code.slice(i, i + kw.length) === kw) {
          complexity++;
        }
      }
    }

    return complexity;
  }

  private getLineNumber(code: string, index: number): number {
    return code.slice(0, index).split('\n').length;
  }
}

// =============================================================================
// TEST GENERATOR SERVICE
// =============================================================================

export class TestGeneratorService {
  private static instance: TestGeneratorService;
  private analyzer: CodeAnalyzer;
  private testSuites: Map<string, TestSuite> = new Map();

  private constructor() {
    this.analyzer = new CodeAnalyzer();
  }

  static getInstance(): TestGeneratorService {
    if (!TestGeneratorService.instance) {
      TestGeneratorService.instance = new TestGeneratorService();
    }
    return TestGeneratorService.instance;
  }

  // ===========================================================================
  // TEST GENERATION
  // ===========================================================================

  async generateTests(
    sourceCode: string,
    sourceFile: string,
    config: TestConfig
  ): Promise<TestSuite> {
    const analysis = this.analyzer.analyze(sourceCode, config.language);
    const suiteId = this.generateId();
    const now = new Date().toISOString();

    const tests: GeneratedTest[] = [];

    // Generate tests for each function
    for (const func of analysis.functions) {
      if (func.exported) {
        tests.push(this.generateFunctionTest(func, sourceFile, analysis, config));
      }
    }

    // Generate tests for each class
    for (const cls of analysis.classes) {
      if (cls.exported) {
        tests.push(...this.generateClassTests(cls, sourceFile, analysis, config));
      }
    }

    // Generate integration tests if there are external dependencies
    if (analysis.dependencies.length > 0 && config.mockExternals) {
      tests.push(this.generateIntegrationTest(analysis, sourceFile, config));
    }

    const suite: TestSuite = {
      id: suiteId,
      name: this.getModuleName(sourceFile),
      targetModule: sourceFile,
      tests,
      setup: this.generateSetup(analysis, config),
      teardown: this.generateTeardown(analysis, config),
      createdAt: now,
    };

    this.testSuites.set(suiteId, suite);

    return suite;
  }

  private generateFunctionTest(
    func: FunctionInfo,
    sourceFile: string,
    analysis: CodeAnalysis,
    config: TestConfig
  ): GeneratedTest {
    const testId = this.generateId();
    const now = new Date().toISOString();
    const mocks = this.generateMocks(analysis, config);
    const fixtures = this.generateFixtures(func);

    let code = '';

    switch (config.framework) {
      case 'jest':
      case 'vitest':
        code = this.generateJestTest(func, sourceFile, mocks, fixtures);
        break;
      case 'pytest':
        code = this.generatePytestTest(func, sourceFile, mocks, fixtures);
        break;
      default:
        code = this.generateJestTest(func, sourceFile, mocks, fixtures);
    }

    return {
      id: testId,
      name: `${func.name}.test.${config.language === 'python' ? 'py' : 'ts'}`,
      type: 'unit',
      filePath: this.getTestFilePath(sourceFile, func.name, config),
      targetFile: sourceFile,
      targetFunction: func.name,
      code,
      assertions: this.countAssertions(code),
      mocks,
      fixtures,
      createdAt: now,
    };
  }

  private generateClassTests(
    cls: ClassInfo,
    sourceFile: string,
    analysis: CodeAnalysis,
    config: TestConfig
  ): GeneratedTest[] {
    const tests: GeneratedTest[] = [];
    const mocks = this.generateMocks(analysis, config);

    // Generate test for each method
    for (const method of cls.methods) {
      const testId = this.generateId();
      const now = new Date().toISOString();
      const fixtures = this.generateFixtures(method);

      let code = '';

      switch (config.framework) {
        case 'jest':
        case 'vitest':
          code = this.generateJestClassTest(cls, method, sourceFile, mocks, fixtures);
          break;
        case 'pytest':
          code = this.generatePytestClassTest(cls, method, sourceFile, mocks, fixtures);
          break;
        default:
          code = this.generateJestClassTest(cls, method, sourceFile, mocks, fixtures);
      }

      tests.push({
        id: testId,
        name: `${cls.name}.${method.name}.test.${config.language === 'python' ? 'py' : 'ts'}`,
        type: 'unit',
        filePath: this.getTestFilePath(sourceFile, `${cls.name}.${method.name}`, config),
        targetFile: sourceFile,
        targetFunction: `${cls.name}.${method.name}`,
        code,
        assertions: this.countAssertions(code),
        mocks,
        fixtures,
        createdAt: now,
      });
    }

    return tests;
  }

  private generateIntegrationTest(
    analysis: CodeAnalysis,
    sourceFile: string,
    config: TestConfig
  ): GeneratedTest {
    const testId = this.generateId();
    const now = new Date().toISOString();
    const mocks = this.generateMocks(analysis, config);

    const moduleName = this.getModuleName(sourceFile);
    const exportedFunctions = analysis.functions.filter((f) => f.exported);

    let code = '';

    if (config.framework === 'jest' || config.framework === 'vitest') {
      code = `import { ${exportedFunctions.map((f) => f.name).join(', ')} } from '${sourceFile.replace(/\.(ts|js)$/, '')}';

// Mock external dependencies
${mocks.map((m) => `jest.mock('${m.module}');`).join('\n')}

describe('${moduleName} Integration', () => {
  beforeAll(() => {
    // Setup integration test environment
  });

  afterAll(() => {
    // Cleanup
  });

${exportedFunctions
  .map(
    (f) => `
  describe('${f.name}', () => {
    it('should integrate correctly with dependencies', async () => {
      // Arrange
      ${f.params.map((p) => `const ${p.name} = ${this.getDefaultValue(p)};`).join('\n      ')}

      // Act
      ${f.async ? 'await ' : ''}${f.name}(${f.params.map((p) => p.name).join(', ')});

      // Assert
      expect(true).toBe(true); // TODO: Add integration assertions
    });
  });
`
  )
  .join('\n')}
});
`;
    }

    return {
      id: testId,
      name: `${moduleName}.integration.test.ts`,
      type: 'integration',
      filePath: this.getTestFilePath(sourceFile, 'integration', config),
      targetFile: sourceFile,
      code,
      assertions: this.countAssertions(code),
      mocks,
      createdAt: now,
    };
  }

  private generateJestTest(
    func: FunctionInfo,
    sourceFile: string,
    mocks: MockDefinition[],
    fixtures: TestFixture[]
  ): string {
    const importPath = sourceFile.replace(/\.(ts|js)$/, '');

    return `import { ${func.name} } from '${importPath}';

${mocks.length > 0 ? mocks.map((m) => `jest.mock('${m.module}');`).join('\n') : ''}

describe('${func.name}', () => {
  ${
    fixtures.length > 0
      ? `
  const fixtures = {
    ${fixtures.map((f) => `${f.name}: ${JSON.stringify(f.data, null, 2)}`).join(',\n    ')}
  };
`
      : ''
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(${func.name}).toBeDefined();
  });

  ${
    func.params.length > 0
      ? `
  it('should handle valid input', ${func.async ? 'async ' : ''}() => {
    // Arrange
    ${func.params.map((p) => `const ${p.name} = ${this.getDefaultValue(p)};`).join('\n    ')}

    // Act
    const result = ${func.async ? 'await ' : ''}${func.name}(${func.params.map((p) => p.name).join(', ')});

    // Assert
    expect(result).toBeDefined();
  });

  it('should handle edge cases', ${func.async ? 'async ' : ''}() => {
    // Arrange
    ${func.params
      .map((p) => `const ${p.name} = ${this.getEdgeCaseValue(p)};`)
      .join('\n    ')}

    // Act & Assert
    ${
      func.async
        ? `await expect(${func.name}(${func.params.map((p) => p.name).join(', ')})).resolves.toBeDefined();`
        : `expect(() => ${func.name}(${func.params.map((p) => p.name).join(', ')})).not.toThrow();`
    }
  });
`
      : `
  it('should execute without errors', ${func.async ? 'async ' : ''}() => {
    // Act
    const result = ${func.async ? 'await ' : ''}${func.name}();

    // Assert
    expect(result).toBeDefined();
  });
`
  }

  ${
    func.async
      ? `
  it('should handle async errors gracefully', async () => {
    // This test verifies error handling
    // TODO: Add specific error scenarios based on function behavior
  });
`
      : ''
  }
});
`;
  }

  private generateJestClassTest(
    cls: ClassInfo,
    method: FunctionInfo,
    sourceFile: string,
    mocks: MockDefinition[],
    fixtures: TestFixture[]
  ): string {
    const importPath = sourceFile.replace(/\.(ts|js)$/, '');

    return `import { ${cls.name} } from '${importPath}';

${mocks.length > 0 ? mocks.map((m) => `jest.mock('${m.module}');`).join('\n') : ''}

describe('${cls.name}', () => {
  let instance: ${cls.name};

  beforeEach(() => {
    instance = new ${cls.name}();
    jest.clearAllMocks();
  });

  describe('${method.name}', () => {
    ${
      fixtures.length > 0
        ? `
    const fixtures = {
      ${fixtures.map((f) => `${f.name}: ${JSON.stringify(f.data, null, 2)}`).join(',\n      ')}
    };
`
        : ''
    }

    it('should be defined', () => {
      expect(instance.${method.name}).toBeDefined();
    });

    it('should handle valid input', ${method.async ? 'async ' : ''}() => {
      // Arrange
      ${method.params.map((p) => `const ${p.name} = ${this.getDefaultValue(p)};`).join('\n      ')}

      // Act
      const result = ${method.async ? 'await ' : ''}instance.${method.name}(${method.params.map((p) => p.name).join(', ')});

      // Assert
      expect(result).toBeDefined();
    });

    it('should handle edge cases', ${method.async ? 'async ' : ''}() => {
      // Arrange
      ${method.params
        .map((p) => `const ${p.name} = ${this.getEdgeCaseValue(p)};`)
        .join('\n      ')}

      // Act & Assert
      ${
        method.async
          ? `await expect(instance.${method.name}(${method.params.map((p) => p.name).join(', ')})).resolves.toBeDefined();`
          : `expect(() => instance.${method.name}(${method.params.map((p) => p.name).join(', ')})).not.toThrow();`
      }
    });
  });
});
`;
  }

  private generatePytestTest(
    func: FunctionInfo,
    sourceFile: string,
    mocks: MockDefinition[],
    fixtures: TestFixture[]
  ): string {
    const modulePath = sourceFile.replace(/\.py$/, '').replace(/\//g, '.');

    return `import pytest
from unittest.mock import Mock, patch
from ${modulePath} import ${func.name}

${
  fixtures.length > 0
    ? `
@pytest.fixture
def fixtures():
    return {
        ${fixtures.map((f) => `'${f.name}': ${JSON.stringify(f.data)}`).join(',\n        ')}
    }
`
    : ''
}

class Test${this.capitalize(func.name)}:
    def test_should_be_defined(self):
        assert ${func.name} is not None

    ${
      func.params.length > 0
        ? `
    ${func.async ? '@pytest.mark.asyncio\n    async ' : ''}def test_should_handle_valid_input(self):
        # Arrange
        ${func.params.map((p) => `${p.name} = ${this.getPythonDefaultValue(p)}`).join('\n        ')}

        # Act
        result = ${func.async ? 'await ' : ''}${func.name}(${func.params.map((p) => p.name).join(', ')})

        # Assert
        assert result is not None

    ${func.async ? '@pytest.mark.asyncio\n    async ' : ''}def test_should_handle_edge_cases(self):
        # Arrange
        ${func.params.map((p) => `${p.name} = ${this.getPythonEdgeCaseValue(p)}`).join('\n        ')}

        # Act
        result = ${func.async ? 'await ' : ''}${func.name}(${func.params.map((p) => p.name).join(', ')})

        # Assert
        assert result is not None
`
        : `
    ${func.async ? '@pytest.mark.asyncio\n    async ' : ''}def test_should_execute_without_errors(self):
        # Act
        result = ${func.async ? 'await ' : ''}${func.name}()

        # Assert
        assert result is not None
`
    }

${mocks
  .map(
    (m) => `
    @patch('${m.module}')
    ${func.async ? '@pytest.mark.asyncio\n    async ' : ''}def test_with_mocked_${m.name.toLowerCase()}(self, mock_${m.name.toLowerCase()}):
        # Arrange
        mock_${m.name.toLowerCase()}.return_value = Mock()

        # Act
        result = ${func.async ? 'await ' : ''}${func.name}(${func.params.map((p) => p.name).join(', ')})

        # Assert
        mock_${m.name.toLowerCase()}.assert_called()
`
  )
  .join('\n')}
`;
  }

  private generatePytestClassTest(
    cls: ClassInfo,
    method: FunctionInfo,
    sourceFile: string,
    mocks: MockDefinition[],
    _fixtures: TestFixture[]
  ): string {
    const modulePath = sourceFile.replace(/\.py$/, '').replace(/\//g, '.');

    return `import pytest
from unittest.mock import Mock, patch
from ${modulePath} import ${cls.name}

class Test${cls.name}${this.capitalize(method.name)}:
    @pytest.fixture
    def instance(self):
        return ${cls.name}()

    def test_should_be_defined(self, instance):
        assert hasattr(instance, '${method.name}')

    ${method.async ? '@pytest.mark.asyncio\n    async ' : ''}def test_should_handle_valid_input(self, instance):
        # Arrange
        ${method.params.map((p) => `${p.name} = ${this.getPythonDefaultValue(p)}`).join('\n        ')}

        # Act
        result = ${method.async ? 'await ' : ''}instance.${method.name}(${method.params.map((p) => p.name).join(', ')})

        # Assert
        assert result is not None

${mocks
  .map(
    (m) => `
    @patch('${m.module}')
    ${method.async ? '@pytest.mark.asyncio\n    async ' : ''}def test_with_mocked_${m.name.toLowerCase()}(self, mock_${m.name.toLowerCase()}, instance):
        # Arrange
        mock_${m.name.toLowerCase()}.return_value = Mock()

        # Act
        result = ${method.async ? 'await ' : ''}instance.${method.name}()

        # Assert
        mock_${m.name.toLowerCase()}.assert_called()
`
  )
  .join('\n')}
`;
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  private generateMocks(analysis: CodeAnalysis, config: TestConfig): MockDefinition[] {
    if (!config.mockExternals) return [];

    return analysis.dependencies
      .filter((dep) => !['react', 'vue', 'next'].includes(dep))
      .map((dep) => ({
        name: this.capitalize(dep.split('/').pop() || dep),
        module: dep,
        type: 'module' as const,
        implementation: '{}',
      }));
  }

  private generateFixtures(func: FunctionInfo): TestFixture[] {
    const fixtures: TestFixture[] = [];

    for (const param of func.params) {
      if (param.type?.includes('[]') || param.type?.includes('Array')) {
        fixtures.push({
          name: `${param.name}Fixture`,
          data: [],
          description: `Test data for ${param.name}`,
        });
      } else if (param.type?.includes('object') || param.type?.includes('Record')) {
        fixtures.push({
          name: `${param.name}Fixture`,
          data: {},
          description: `Test data for ${param.name}`,
        });
      }
    }

    return fixtures;
  }

  private generateSetup(analysis: CodeAnalysis, config: TestConfig): string {
    if (config.framework === 'jest' || config.framework === 'vitest') {
      return `beforeAll(() => {
  // Global setup
});

afterAll(() => {
  // Global cleanup
});`;
    }

    if (config.framework === 'pytest') {
      return `@pytest.fixture(scope='module')
def setup_module():
    # Module-level setup
    yield
    # Module-level teardown`;
    }

    return '';
  }

  private generateTeardown(_analysis: CodeAnalysis, _config: TestConfig): string {
    return '';
  }

  private getDefaultValue(param: ParamInfo): string {
    if (param.defaultValue) return param.defaultValue;

    const type = param.type?.toLowerCase() || '';

    if (type.includes('string')) return "'test'";
    if (type.includes('number') || type.includes('int')) return '1';
    if (type.includes('boolean') || type.includes('bool')) return 'true';
    if (type.includes('array') || type.includes('[]')) return '[]';
    if (type.includes('object') || type.includes('record')) return '{}';
    if (type.includes('null')) return 'null';
    if (type.includes('undefined')) return 'undefined';

    return "{}";
  }

  private getEdgeCaseValue(param: ParamInfo): string {
    const type = param.type?.toLowerCase() || '';

    if (type.includes('string')) return "''";
    if (type.includes('number') || type.includes('int')) return '0';
    if (type.includes('boolean') || type.includes('bool')) return 'false';
    if (type.includes('array') || type.includes('[]')) return '[]';
    if (type.includes('null')) return 'null';

    return param.optional ? 'undefined' : '{}';
  }

  private getPythonDefaultValue(param: ParamInfo): string {
    if (param.defaultValue) return param.defaultValue;

    const type = param.type?.toLowerCase() || '';

    if (type.includes('str')) return "'test'";
    if (type.includes('int')) return '1';
    if (type.includes('float')) return '1.0';
    if (type.includes('bool')) return 'True';
    if (type.includes('list')) return '[]';
    if (type.includes('dict')) return '{}';
    if (type.includes('none')) return 'None';

    return '{}';
  }

  private getPythonEdgeCaseValue(param: ParamInfo): string {
    const type = param.type?.toLowerCase() || '';

    if (type.includes('str')) return "''";
    if (type.includes('int')) return '0';
    if (type.includes('float')) return '0.0';
    if (type.includes('bool')) return 'False';
    if (type.includes('list')) return '[]';
    if (type.includes('none')) return 'None';

    return param.optional ? 'None' : '{}';
  }

  private getTestFilePath(sourceFile: string, testName: string, config: TestConfig): string {
    const dir = config.outputDir || '__tests__';
    const ext = config.language === 'python' ? 'py' : 'ts';
    const baseName = sourceFile.split('/').pop()?.replace(/\.(ts|js|py)$/, '') || 'test';

    return `${dir}/${baseName}.${testName}.test.${ext}`;
  }

  private getModuleName(sourceFile: string): string {
    return sourceFile.split('/').pop()?.replace(/\.(ts|js|py)$/, '') || 'module';
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private countAssertions(code: string): number {
    const assertPatterns = [
      /expect\(/g,
      /assert/g,
      /toBe/g,
      /toEqual/g,
      /toMatch/g,
      /toThrow/g,
      /toHaveBeenCalled/g,
    ];

    let count = 0;
    for (const pattern of assertPatterns) {
      const matches = code.match(pattern);
      if (matches) count += matches.length;
    }

    return Math.max(1, Math.floor(count / 2)); // Deduplicate expect().toBe() patterns
  }

  private generateId(): string {
    return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ===========================================================================
  // SUITE MANAGEMENT
  // ===========================================================================

  async getTestSuite(suiteId: string): Promise<TestSuite | null> {
    return this.testSuites.get(suiteId) || null;
  }

  async listTestSuites(): Promise<TestSuite[]> {
    return Array.from(this.testSuites.values());
  }

  async deleteTestSuite(suiteId: string): Promise<void> {
    this.testSuites.delete(suiteId);
  }
}

// Export singleton
export const testGenerator = TestGeneratorService.getInstance();
