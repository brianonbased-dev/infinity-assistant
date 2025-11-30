/**
 * Database Automation Types
 *
 * Type definitions for automated schema design, migrations, and database management
 */

// =============================================================================
// DATABASE PROVIDER TYPES
// =============================================================================

export type DatabaseProvider =
  | 'supabase'
  | 'planetscale'
  | 'neon'
  | 'mongodb'
  | 'postgres'
  | 'mysql'
  | 'sqlite'
  | 'cockroachdb'
  | 'redis'
  | 'dynamodb';

export type DatabaseType = 'relational' | 'document' | 'key_value' | 'graph' | 'time_series';

// =============================================================================
// SCHEMA TYPES
// =============================================================================

export interface DatabaseSchema {
  id: string;
  name: string;
  provider: DatabaseProvider;
  type: DatabaseType;
  version: number;
  tables: TableDefinition[];
  relationships: RelationshipDefinition[];
  indexes: IndexDefinition[];
  views?: ViewDefinition[];
  functions?: FunctionDefinition[];
  triggers?: TriggerDefinition[];
  policies?: PolicyDefinition[]; // RLS policies
  createdAt: string;
  updatedAt: string;
}

export interface TableDefinition {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  columns: ColumnDefinition[];
  primaryKey: string | string[];
  uniqueConstraints?: UniqueConstraint[];
  checkConstraints?: CheckConstraint[];
  timestamps?: boolean; // Auto add created_at, updated_at
  softDelete?: boolean; // Auto add deleted_at
  audit?: boolean; // Auto add audit columns
}

export interface ColumnDefinition {
  name: string;
  type: ColumnType;
  nullable: boolean;
  defaultValue?: string | number | boolean | null;
  unique?: boolean;
  primaryKey?: boolean;
  references?: ForeignKeyReference;
  generated?: GeneratedColumn;
  validation?: ColumnValidation;
  comment?: string;
}

export type ColumnType =
  // Numeric
  | 'integer'
  | 'bigint'
  | 'smallint'
  | 'decimal'
  | 'numeric'
  | 'real'
  | 'double'
  | 'serial'
  | 'bigserial'
  // String
  | 'varchar'
  | 'char'
  | 'text'
  | 'uuid'
  | 'citext'
  // Date/Time
  | 'date'
  | 'time'
  | 'timestamp'
  | 'timestamptz'
  | 'interval'
  // Boolean
  | 'boolean'
  // Binary
  | 'bytea'
  | 'blob'
  // JSON
  | 'json'
  | 'jsonb'
  // Array
  | 'array'
  // Geometric
  | 'point'
  | 'line'
  | 'polygon'
  // Network
  | 'inet'
  | 'cidr'
  | 'macaddr'
  // Custom
  | 'enum'
  | 'custom';

export interface ForeignKeyReference {
  table: string;
  column: string;
  onDelete?: 'cascade' | 'set_null' | 'set_default' | 'restrict' | 'no_action';
  onUpdate?: 'cascade' | 'set_null' | 'set_default' | 'restrict' | 'no_action';
}

export interface GeneratedColumn {
  type: 'stored' | 'virtual';
  expression: string;
}

export interface ColumnValidation {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  enum?: string[];
  custom?: string; // SQL check expression
}

export interface UniqueConstraint {
  name: string;
  columns: string[];
  where?: string; // Partial unique constraint
}

export interface CheckConstraint {
  name: string;
  expression: string;
}

// =============================================================================
// RELATIONSHIP TYPES
// =============================================================================

export interface RelationshipDefinition {
  id: string;
  name: string;
  type: RelationshipType;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  joinTable?: JoinTableDefinition; // For many-to-many
  cascadeDelete?: boolean;
  cascadeUpdate?: boolean;
}

export type RelationshipType = 'one_to_one' | 'one_to_many' | 'many_to_many';

export interface JoinTableDefinition {
  name: string;
  sourceKeyColumn: string;
  targetKeyColumn: string;
  additionalColumns?: ColumnDefinition[];
}

// =============================================================================
// INDEX TYPES
// =============================================================================

export interface IndexDefinition {
  id: string;
  name: string;
  table: string;
  columns: IndexColumn[];
  type: IndexType;
  unique?: boolean;
  where?: string; // Partial index
  include?: string[]; // Covering index columns
  tablespace?: string;
}

export interface IndexColumn {
  name: string;
  order?: 'asc' | 'desc';
  nulls?: 'first' | 'last';
  opclass?: string;
}

export type IndexType =
  | 'btree'
  | 'hash'
  | 'gist'
  | 'spgist'
  | 'gin'
  | 'brin'
  | 'fulltext';

// =============================================================================
// VIEW TYPES
// =============================================================================

export interface ViewDefinition {
  id: string;
  name: string;
  query: string;
  materialized?: boolean;
  refreshInterval?: number; // For materialized views, in seconds
  columns?: ViewColumn[];
}

export interface ViewColumn {
  name: string;
  alias?: string;
  expression?: string;
}

// =============================================================================
// FUNCTION TYPES
// =============================================================================

export interface FunctionDefinition {
  id: string;
  name: string;
  parameters: FunctionParameter[];
  returnType: string;
  language: 'sql' | 'plpgsql' | 'javascript' | 'python';
  body: string;
  volatility?: 'immutable' | 'stable' | 'volatile';
  security?: 'definer' | 'invoker';
}

export interface FunctionParameter {
  name: string;
  type: string;
  default?: string;
  mode?: 'in' | 'out' | 'inout' | 'variadic';
}

// =============================================================================
// TRIGGER TYPES
// =============================================================================

export interface TriggerDefinition {
  id: string;
  name: string;
  table: string;
  timing: 'before' | 'after' | 'instead_of';
  events: TriggerEvent[];
  level: 'row' | 'statement';
  function: string;
  condition?: string;
  enabled?: boolean;
}

export type TriggerEvent = 'insert' | 'update' | 'delete' | 'truncate';

// =============================================================================
// POLICY TYPES (Row Level Security)
// =============================================================================

export interface PolicyDefinition {
  id: string;
  name: string;
  table: string;
  command: 'all' | 'select' | 'insert' | 'update' | 'delete';
  roles?: string[];
  using?: string; // Expression for SELECT/UPDATE/DELETE
  withCheck?: string; // Expression for INSERT/UPDATE
  permissive?: boolean; // Default true
}

// =============================================================================
// MIGRATION TYPES
// =============================================================================

export interface Migration {
  id: string;
  version: number;
  name: string;
  description?: string;
  schemaId: string;

  // Migration content
  up: MigrationStatement[];
  down: MigrationStatement[];

  // Status
  status: MigrationStatus;
  appliedAt?: string;
  rolledBackAt?: string;

  // Metadata
  createdAt: string;
  createdBy: string;
  checksum: string; // For detecting changes
}

export type MigrationStatus = 'pending' | 'applied' | 'failed' | 'rolled_back';

export interface MigrationStatement {
  type: StatementType;
  sql: string;
  description?: string;
  transaction?: boolean; // Run in transaction
  timeout?: number; // Statement timeout in seconds
}

export type StatementType =
  | 'create_table'
  | 'alter_table'
  | 'drop_table'
  | 'rename_table'
  | 'add_column'
  | 'alter_column'
  | 'drop_column'
  | 'rename_column'
  | 'add_index'
  | 'drop_index'
  | 'add_constraint'
  | 'drop_constraint'
  | 'create_view'
  | 'drop_view'
  | 'create_function'
  | 'drop_function'
  | 'create_trigger'
  | 'drop_trigger'
  | 'create_policy'
  | 'drop_policy'
  | 'raw_sql';

// =============================================================================
// SCHEMA DIFF TYPES
// =============================================================================

export interface SchemaDiff {
  sourceSchema: DatabaseSchema;
  targetSchema: DatabaseSchema;
  changes: SchemaChange[];
  migrationStatements: MigrationStatement[];
  destructive: boolean;
  warnings: string[];
}

export interface SchemaChange {
  type: SchemaChangeType;
  entity: 'table' | 'column' | 'index' | 'relationship' | 'view' | 'function' | 'trigger' | 'policy';
  name: string;
  table?: string;
  before?: unknown;
  after?: unknown;
  breaking: boolean;
  description: string;
}

export type SchemaChangeType =
  | 'added'
  | 'removed'
  | 'modified'
  | 'renamed';

// =============================================================================
// SEED DATA TYPES
// =============================================================================

export interface SeedData {
  id: string;
  name: string;
  schemaId: string;
  tables: TableSeed[];
  dependencies?: string[]; // Other seeds to run first
  environment?: 'all' | 'development' | 'staging' | 'production';
  createdAt: string;
}

export interface TableSeed {
  table: string;
  truncate?: boolean;
  data: Record<string, unknown>[];
  onConflict?: 'ignore' | 'update' | 'error';
  updateColumns?: string[];
}

// =============================================================================
// SCHEMA GENERATION TYPES
// =============================================================================

export interface SchemaGenerationRequest {
  description: string;
  entities: EntityDescription[];
  features: SchemaFeature[];
  provider: DatabaseProvider;
  options?: SchemaGenerationOptions;
}

export interface EntityDescription {
  name: string;
  description: string;
  fields?: FieldDescription[];
  relationships?: string[];
}

export interface FieldDescription {
  name: string;
  description?: string;
  type?: string;
  required?: boolean;
  unique?: boolean;
}

export type SchemaFeature =
  | 'timestamps'
  | 'soft_delete'
  | 'audit_log'
  | 'uuid_primary_keys'
  | 'row_level_security'
  | 'full_text_search'
  | 'multi_tenancy';

export interface SchemaGenerationOptions {
  namingConvention?: 'snake_case' | 'camelCase' | 'PascalCase';
  pluralizeTableNames?: boolean;
  prefixTableNames?: string;
  includeTimestamps?: boolean;
  useSoftDelete?: boolean;
  generateIndexes?: boolean;
}

// =============================================================================
// CONNECTION TYPES
// =============================================================================

export interface DatabaseConnection {
  id: string;
  name: string;
  provider: DatabaseProvider;
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string; // Encrypted
  ssl?: SSLConfig;
  poolSize?: number;
  connectionTimeout?: number;
  idleTimeout?: number;
}

export interface SSLConfig {
  enabled: boolean;
  rejectUnauthorized?: boolean;
  ca?: string;
  cert?: string;
  key?: string;
}

// =============================================================================
// QUERY BUILDER TYPES
// =============================================================================

export interface QueryBuilder {
  select: (columns?: string[]) => QueryBuilder;
  from: (table: string) => QueryBuilder;
  where: (condition: WhereCondition) => QueryBuilder;
  join: (join: JoinClause) => QueryBuilder;
  groupBy: (columns: string[]) => QueryBuilder;
  orderBy: (column: string, direction?: 'asc' | 'desc') => QueryBuilder;
  limit: (count: number) => QueryBuilder;
  offset: (count: number) => QueryBuilder;
  toSQL: () => string;
}

export interface WhereCondition {
  column: string;
  operator: WhereOperator;
  value: unknown;
  connector?: 'and' | 'or';
}

export type WhereOperator =
  | '='
  | '!='
  | '<'
  | '>'
  | '<='
  | '>='
  | 'like'
  | 'ilike'
  | 'in'
  | 'not_in'
  | 'is_null'
  | 'is_not_null'
  | 'between';

export interface JoinClause {
  type: 'inner' | 'left' | 'right' | 'full';
  table: string;
  on: {
    leftColumn: string;
    rightColumn: string;
  };
}

// =============================================================================
// EVENT TYPES
// =============================================================================

export type DatabaseEvent =
  | { type: 'schema_created'; data: DatabaseSchema }
  | { type: 'schema_updated'; data: { schemaId: string; changes: SchemaChange[] } }
  | { type: 'migration_created'; data: Migration }
  | { type: 'migration_applied'; data: { migrationId: string; duration: number } }
  | { type: 'migration_failed'; data: { migrationId: string; error: string } }
  | { type: 'migration_rolled_back'; data: { migrationId: string } }
  | { type: 'seed_executed'; data: { seedId: string; rowsAffected: number } }
  | { type: 'connection_established'; data: { connectionId: string } }
  | { type: 'connection_failed'; data: { connectionId: string; error: string } };

export type DatabaseEventHandler = (event: DatabaseEvent) => void | Promise<void>;
