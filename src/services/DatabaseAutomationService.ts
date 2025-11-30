/**
 * Database Automation Service
 *
 * Automated schema design, migration generation, and database management.
 * Supports multiple database providers and includes AI-powered schema generation.
 */

import { createHash } from 'crypto';
import type {
  DatabaseSchema,
  TableDefinition,
  ColumnDefinition,
  ColumnType,
  RelationshipDefinition,
  IndexDefinition,
  Migration,
  MigrationStatement,
  MigrationStatus,
  StatementType,
  SchemaDiff,
  SchemaChange,
  SeedData,
  TableSeed,
  SchemaGenerationRequest,
  EntityDescription,
  SchemaFeature,
  DatabaseProvider,
  DatabaseConnection,
  DatabaseEvent,
  DatabaseEventHandler,
  PolicyDefinition,
  ForeignKeyReference,
} from '../types/database-automation';

// =============================================================================
// SCHEMA GENERATOR
// =============================================================================

class SchemaGenerator {
  generateFromDescription(request: SchemaGenerationRequest): DatabaseSchema {
    const schemaId = this.generateId();
    const now = new Date().toISOString();

    const tables: TableDefinition[] = [];
    const relationships: RelationshipDefinition[] = [];
    const indexes: IndexDefinition[] = [];
    const policies: PolicyDefinition[] = [];

    // Generate tables from entity descriptions
    for (const entity of request.entities) {
      const table = this.generateTable(entity, request);
      tables.push(table);

      // Generate indexes for common patterns
      if (request.options?.generateIndexes !== false) {
        indexes.push(...this.generateTableIndexes(table));
      }
    }

    // Generate relationships
    for (const entity of request.entities) {
      if (entity.relationships) {
        for (const rel of entity.relationships) {
          const relationship = this.parseRelationship(
            entity.name,
            rel,
            tables,
            request
          );
          if (relationship) {
            relationships.push(relationship);
          }
        }
      }
    }

    // Generate RLS policies if enabled
    if (request.features.includes('row_level_security')) {
      for (const table of tables) {
        policies.push(...this.generateRLSPolicies(table));
      }
    }

    return {
      id: schemaId,
      name: request.description.toLowerCase().replace(/\s+/g, '_'),
      provider: request.provider,
      type: 'relational',
      version: 1,
      tables,
      relationships,
      indexes,
      policies,
      createdAt: now,
      updatedAt: now,
    };
  }

  private generateTable(
    entity: EntityDescription,
    request: SchemaGenerationRequest
  ): TableDefinition {
    const tableName = this.formatTableName(entity.name, request);
    const columns: ColumnDefinition[] = [];

    // Generate primary key
    const usesUUID = request.features.includes('uuid_primary_keys');
    columns.push({
      name: 'id',
      type: usesUUID ? 'uuid' : 'bigserial',
      nullable: false,
      primaryKey: true,
      defaultValue: usesUUID ? 'gen_random_uuid()' : undefined,
    });

    // Generate columns from fields
    if (entity.fields) {
      for (const field of entity.fields) {
        columns.push(this.generateColumn(field, request));
      }
    } else {
      // Auto-generate columns from entity name/description
      columns.push(...this.inferColumns(entity));
    }

    // Add timestamps
    if (
      request.features.includes('timestamps') ||
      request.options?.includeTimestamps !== false
    ) {
      columns.push({
        name: 'created_at',
        type: 'timestamptz',
        nullable: false,
        defaultValue: 'now()',
      });
      columns.push({
        name: 'updated_at',
        type: 'timestamptz',
        nullable: false,
        defaultValue: 'now()',
      });
    }

    // Add soft delete column
    if (request.features.includes('soft_delete') || request.options?.useSoftDelete) {
      columns.push({
        name: 'deleted_at',
        type: 'timestamptz',
        nullable: true,
      });
    }

    // Add audit columns
    if (request.features.includes('audit_log')) {
      columns.push({
        name: 'created_by',
        type: 'uuid',
        nullable: true,
      });
      columns.push({
        name: 'updated_by',
        type: 'uuid',
        nullable: true,
      });
    }

    // Add tenant column for multi-tenancy
    if (request.features.includes('multi_tenancy')) {
      columns.push({
        name: 'tenant_id',
        type: 'uuid',
        nullable: false,
      });
    }

    return {
      id: this.generateId(),
      name: tableName,
      displayName: entity.name,
      description: entity.description,
      columns,
      primaryKey: 'id',
      timestamps: request.features.includes('timestamps'),
      softDelete: request.features.includes('soft_delete'),
      audit: request.features.includes('audit_log'),
    };
  }

  private generateColumn(
    field: { name: string; description?: string; type?: string; required?: boolean; unique?: boolean },
    _request: SchemaGenerationRequest
  ): ColumnDefinition {
    const columnName = this.formatColumnName(field.name);
    const columnType = field.type
      ? this.mapFieldType(field.type)
      : this.inferColumnType(field.name, field.description);

    return {
      name: columnName,
      type: columnType,
      nullable: !field.required,
      unique: field.unique,
      comment: field.description,
    };
  }

  private inferColumns(entity: EntityDescription): ColumnDefinition[] {
    const columns: ColumnDefinition[] = [];
    const entityLower = entity.name.toLowerCase();

    // Common patterns based on entity name
    if (entityLower.includes('user') || entityLower.includes('account')) {
      columns.push(
        { name: 'email', type: 'varchar', nullable: false, unique: true },
        { name: 'name', type: 'varchar', nullable: true },
        { name: 'avatar_url', type: 'text', nullable: true },
        { name: 'status', type: 'varchar', nullable: false, defaultValue: "'active'" }
      );
    } else if (entityLower.includes('post') || entityLower.includes('article')) {
      columns.push(
        { name: 'title', type: 'varchar', nullable: false },
        { name: 'slug', type: 'varchar', nullable: false, unique: true },
        { name: 'content', type: 'text', nullable: true },
        { name: 'published_at', type: 'timestamptz', nullable: true },
        { name: 'status', type: 'varchar', nullable: false, defaultValue: "'draft'" }
      );
    } else if (entityLower.includes('product')) {
      columns.push(
        { name: 'name', type: 'varchar', nullable: false },
        { name: 'description', type: 'text', nullable: true },
        { name: 'price', type: 'decimal', nullable: false },
        { name: 'sku', type: 'varchar', nullable: true, unique: true },
        { name: 'inventory_count', type: 'integer', nullable: false, defaultValue: '0' }
      );
    } else if (entityLower.includes('order')) {
      columns.push(
        { name: 'order_number', type: 'varchar', nullable: false, unique: true },
        { name: 'status', type: 'varchar', nullable: false, defaultValue: "'pending'" },
        { name: 'total_amount', type: 'decimal', nullable: false },
        { name: 'currency', type: 'varchar', nullable: false, defaultValue: "'USD'" },
        { name: 'notes', type: 'text', nullable: true }
      );
    } else {
      // Generic columns
      columns.push(
        { name: 'name', type: 'varchar', nullable: false },
        { name: 'description', type: 'text', nullable: true },
        { name: 'metadata', type: 'jsonb', nullable: true }
      );
    }

    return columns;
  }

  private generateTableIndexes(table: TableDefinition): IndexDefinition[] {
    const indexes: IndexDefinition[] = [];

    for (const column of table.columns) {
      // Index foreign keys
      if (column.references) {
        indexes.push({
          id: this.generateId(),
          name: `idx_${table.name}_${column.name}`,
          table: table.name,
          columns: [{ name: column.name }],
          type: 'btree',
        });
      }

      // Index commonly searched columns
      if (
        column.name === 'email' ||
        column.name === 'slug' ||
        column.name === 'status' ||
        column.name === 'tenant_id'
      ) {
        indexes.push({
          id: this.generateId(),
          name: `idx_${table.name}_${column.name}`,
          table: table.name,
          columns: [{ name: column.name }],
          type: 'btree',
          unique: column.unique,
        });
      }

      // Full text index for text columns
      if (column.type === 'text' && (column.name === 'content' || column.name === 'description')) {
        indexes.push({
          id: this.generateId(),
          name: `idx_${table.name}_${column.name}_fulltext`,
          table: table.name,
          columns: [{ name: column.name }],
          type: 'gin',
        });
      }
    }

    // Index timestamps for queries
    if (table.timestamps) {
      indexes.push({
        id: this.generateId(),
        name: `idx_${table.name}_created_at`,
        table: table.name,
        columns: [{ name: 'created_at', order: 'desc' }],
        type: 'btree',
      });
    }

    // Partial index for soft delete
    if (table.softDelete) {
      indexes.push({
        id: this.generateId(),
        name: `idx_${table.name}_active`,
        table: table.name,
        columns: [{ name: 'id' }],
        type: 'btree',
        where: 'deleted_at IS NULL',
      });
    }

    return indexes;
  }

  private parseRelationship(
    entityName: string,
    relationshipStr: string,
    tables: TableDefinition[],
    request: SchemaGenerationRequest
  ): RelationshipDefinition | null {
    // Parse relationship strings like "has many posts", "belongs to user", "has one profile"
    const hasMany = relationshipStr.match(/has\s+many\s+(\w+)/i);
    const belongsTo = relationshipStr.match(/belongs\s+to\s+(\w+)/i);
    const hasOne = relationshipStr.match(/has\s+one\s+(\w+)/i);

    const sourceTableName = this.formatTableName(entityName, request);
    const sourceTable = tables.find((t) => t.name === sourceTableName);

    if (!sourceTable) return null;

    if (hasMany) {
      const targetName = hasMany[1];
      const targetTableName = this.formatTableName(targetName, request);
      const targetTable = tables.find((t) => t.name === targetTableName);

      if (targetTable) {
        // Add foreign key to target table
        const fkColumn: ColumnDefinition = {
          name: `${sourceTableName.replace(/s$/, '')}_id`,
          type: sourceTable.columns[0].type, // Match primary key type
          nullable: false,
          references: {
            table: sourceTableName,
            column: 'id',
            onDelete: 'cascade',
          },
        };
        targetTable.columns.push(fkColumn);

        return {
          id: this.generateId(),
          name: `${sourceTableName}_${targetTableName}`,
          type: 'one_to_many',
          sourceTable: sourceTableName,
          sourceColumn: 'id',
          targetTable: targetTableName,
          targetColumn: fkColumn.name,
          cascadeDelete: true,
        };
      }
    }

    if (belongsTo) {
      const targetName = belongsTo[1];
      const targetTableName = this.formatTableName(targetName, request);
      const targetTable = tables.find((t) => t.name === targetTableName);

      if (targetTable) {
        // Add foreign key to source table
        const fkColumn: ColumnDefinition = {
          name: `${targetTableName.replace(/s$/, '')}_id`,
          type: targetTable.columns[0].type,
          nullable: false,
          references: {
            table: targetTableName,
            column: 'id',
          },
        };
        sourceTable.columns.push(fkColumn);

        return {
          id: this.generateId(),
          name: `${sourceTableName}_${targetTableName}`,
          type: 'one_to_many',
          sourceTable: targetTableName,
          sourceColumn: 'id',
          targetTable: sourceTableName,
          targetColumn: fkColumn.name,
        };
      }
    }

    if (hasOne) {
      const targetName = hasOne[1];
      const targetTableName = this.formatTableName(targetName, request);
      const targetTable = tables.find((t) => t.name === targetTableName);

      if (targetTable) {
        const fkColumn: ColumnDefinition = {
          name: `${sourceTableName.replace(/s$/, '')}_id`,
          type: sourceTable.columns[0].type,
          nullable: false,
          unique: true,
          references: {
            table: sourceTableName,
            column: 'id',
            onDelete: 'cascade',
          },
        };
        targetTable.columns.push(fkColumn);

        return {
          id: this.generateId(),
          name: `${sourceTableName}_${targetTableName}`,
          type: 'one_to_one',
          sourceTable: sourceTableName,
          sourceColumn: 'id',
          targetTable: targetTableName,
          targetColumn: fkColumn.name,
          cascadeDelete: true,
        };
      }
    }

    return null;
  }

  private generateRLSPolicies(table: TableDefinition): PolicyDefinition[] {
    const policies: PolicyDefinition[] = [];

    // Check if table has tenant_id (multi-tenancy)
    const hasTenantId = table.columns.some((c) => c.name === 'tenant_id');

    if (hasTenantId) {
      policies.push({
        id: this.generateId(),
        name: `${table.name}_tenant_isolation`,
        table: table.name,
        command: 'all',
        using: "tenant_id = current_setting('app.current_tenant')::uuid",
        withCheck: "tenant_id = current_setting('app.current_tenant')::uuid",
      });
    }

    // Check if table has user ownership
    const hasUserId = table.columns.some(
      (c) => c.name === 'user_id' || c.name === 'owner_id' || c.name === 'created_by'
    );

    if (hasUserId) {
      const userColumn = table.columns.find(
        (c) => c.name === 'user_id' || c.name === 'owner_id' || c.name === 'created_by'
      )!;

      policies.push({
        id: this.generateId(),
        name: `${table.name}_owner_select`,
        table: table.name,
        command: 'select',
        using: `${userColumn.name} = auth.uid()`,
      });

      policies.push({
        id: this.generateId(),
        name: `${table.name}_owner_update`,
        table: table.name,
        command: 'update',
        using: `${userColumn.name} = auth.uid()`,
        withCheck: `${userColumn.name} = auth.uid()`,
      });

      policies.push({
        id: this.generateId(),
        name: `${table.name}_owner_delete`,
        table: table.name,
        command: 'delete',
        using: `${userColumn.name} = auth.uid()`,
      });
    }

    return policies;
  }

  private formatTableName(name: string, request: SchemaGenerationRequest): string {
    let tableName = name.toLowerCase();

    // Convert to snake_case
    tableName = tableName.replace(/([A-Z])/g, '_$1').replace(/^_/, '');
    tableName = tableName.replace(/\s+/g, '_');

    // Pluralize if enabled
    if (request.options?.pluralizeTableNames !== false) {
      if (!tableName.endsWith('s')) {
        tableName += 's';
      }
    }

    // Add prefix if specified
    if (request.options?.prefixTableNames) {
      tableName = `${request.options.prefixTableNames}_${tableName}`;
    }

    return tableName;
  }

  private formatColumnName(name: string): string {
    return name
      .toLowerCase()
      .replace(/([A-Z])/g, '_$1')
      .replace(/^_/, '')
      .replace(/\s+/g, '_');
  }

  private mapFieldType(type: string): ColumnType {
    const typeMap: Record<string, ColumnType> = {
      string: 'varchar',
      text: 'text',
      number: 'integer',
      int: 'integer',
      integer: 'integer',
      bigint: 'bigint',
      float: 'real',
      double: 'double',
      decimal: 'decimal',
      boolean: 'boolean',
      bool: 'boolean',
      date: 'date',
      datetime: 'timestamptz',
      timestamp: 'timestamptz',
      time: 'time',
      json: 'jsonb',
      object: 'jsonb',
      array: 'jsonb',
      uuid: 'uuid',
      email: 'varchar',
      url: 'text',
      binary: 'bytea',
    };

    return typeMap[type.toLowerCase()] || 'varchar';
  }

  private inferColumnType(name: string, _description?: string): ColumnType {
    const nameLower = name.toLowerCase();

    // UUID patterns
    if (nameLower.endsWith('_id') || nameLower === 'uuid') {
      return 'uuid';
    }

    // Email
    if (nameLower.includes('email')) {
      return 'varchar';
    }

    // URLs
    if (nameLower.includes('url') || nameLower.includes('link') || nameLower.includes('avatar')) {
      return 'text';
    }

    // Prices/money
    if (nameLower.includes('price') || nameLower.includes('amount') || nameLower.includes('cost')) {
      return 'decimal';
    }

    // Counts/quantities
    if (nameLower.includes('count') || nameLower.includes('quantity') || nameLower.includes('number')) {
      return 'integer';
    }

    // Dates
    if (nameLower.includes('_at') || nameLower.includes('date') || nameLower.includes('time')) {
      return 'timestamptz';
    }

    // Boolean flags
    if (nameLower.startsWith('is_') || nameLower.startsWith('has_') || nameLower.startsWith('can_')) {
      return 'boolean';
    }

    // JSON/metadata
    if (nameLower.includes('metadata') || nameLower.includes('settings') || nameLower.includes('config')) {
      return 'jsonb';
    }

    // Long text
    if (nameLower.includes('content') || nameLower.includes('body') || nameLower.includes('description')) {
      return 'text';
    }

    // Default to varchar
    return 'varchar';
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// =============================================================================
// MIGRATION GENERATOR
// =============================================================================

class MigrationGenerator {
  generateFromDiff(diff: SchemaDiff): Migration {
    const migrationId = this.generateId();
    const now = new Date().toISOString();

    const upStatements: MigrationStatement[] = [];
    const downStatements: MigrationStatement[] = [];

    // Group changes by entity type and sort for proper dependency order
    const tableChanges = diff.changes.filter((c) => c.entity === 'table');
    const columnChanges = diff.changes.filter((c) => c.entity === 'column');
    const indexChanges = diff.changes.filter((c) => c.entity === 'index');
    const relationshipChanges = diff.changes.filter((c) => c.entity === 'relationship');

    // Process table additions first
    for (const change of tableChanges.filter((c) => c.type === 'added')) {
      const table = change.after as TableDefinition;
      upStatements.push(this.generateCreateTable(table));
      downStatements.unshift(this.generateDropTable(table.name));
    }

    // Process column changes
    for (const change of columnChanges) {
      switch (change.type) {
        case 'added':
          upStatements.push(this.generateAddColumn(change.table!, change.after as ColumnDefinition));
          downStatements.unshift(this.generateDropColumn(change.table!, (change.after as ColumnDefinition).name));
          break;
        case 'removed':
          upStatements.push(this.generateDropColumn(change.table!, change.name));
          downStatements.unshift(this.generateAddColumn(change.table!, change.before as ColumnDefinition));
          break;
        case 'modified':
          upStatements.push(this.generateAlterColumn(change.table!, change.after as ColumnDefinition));
          downStatements.unshift(this.generateAlterColumn(change.table!, change.before as ColumnDefinition));
          break;
      }
    }

    // Process index changes
    for (const change of indexChanges) {
      switch (change.type) {
        case 'added':
          upStatements.push(this.generateCreateIndex(change.after as IndexDefinition));
          downStatements.unshift(this.generateDropIndex((change.after as IndexDefinition).name));
          break;
        case 'removed':
          upStatements.push(this.generateDropIndex(change.name));
          downStatements.unshift(this.generateCreateIndex(change.before as IndexDefinition));
          break;
      }
    }

    // Process relationship changes (foreign keys)
    for (const change of relationshipChanges) {
      switch (change.type) {
        case 'added':
          upStatements.push(this.generateAddForeignKey(change.after as RelationshipDefinition));
          downStatements.unshift(this.generateDropForeignKey(change.after as RelationshipDefinition));
          break;
        case 'removed':
          upStatements.push(this.generateDropForeignKey(change.before as RelationshipDefinition));
          downStatements.unshift(this.generateAddForeignKey(change.before as RelationshipDefinition));
          break;
      }
    }

    // Process table removals last
    for (const change of tableChanges.filter((c) => c.type === 'removed')) {
      const table = change.before as TableDefinition;
      upStatements.push(this.generateDropTable(table.name));
      downStatements.unshift(this.generateCreateTable(table));
    }

    const migration: Migration = {
      id: migrationId,
      version: Date.now(),
      name: `migration_${new Date().toISOString().split('T')[0].replace(/-/g, '')}`,
      schemaId: diff.targetSchema.id,
      up: upStatements,
      down: downStatements,
      status: 'pending',
      createdAt: now,
      createdBy: 'system',
      checksum: this.calculateChecksum(upStatements),
    };

    return migration;
  }

  private generateCreateTable(table: TableDefinition): MigrationStatement {
    const columns = table.columns
      .map((col) => this.formatColumnDefinition(col))
      .join(',\n  ');

    let sql = `CREATE TABLE ${table.name} (\n  ${columns}`;

    // Add primary key constraint
    if (typeof table.primaryKey === 'string') {
      sql += `,\n  PRIMARY KEY (${table.primaryKey})`;
    } else if (Array.isArray(table.primaryKey)) {
      sql += `,\n  PRIMARY KEY (${table.primaryKey.join(', ')})`;
    }

    // Add unique constraints
    if (table.uniqueConstraints) {
      for (const constraint of table.uniqueConstraints) {
        sql += `,\n  CONSTRAINT ${constraint.name} UNIQUE (${constraint.columns.join(', ')})`;
        if (constraint.where) {
          sql += ` WHERE ${constraint.where}`;
        }
      }
    }

    // Add check constraints
    if (table.checkConstraints) {
      for (const constraint of table.checkConstraints) {
        sql += `,\n  CONSTRAINT ${constraint.name} CHECK (${constraint.expression})`;
      }
    }

    sql += '\n);';

    // Add comment if description exists
    if (table.description) {
      sql += `\n\nCOMMENT ON TABLE ${table.name} IS '${table.description.replace(/'/g, "''")}';`;
    }

    return {
      type: 'create_table',
      sql,
      description: `Create table ${table.name}`,
      transaction: true,
    };
  }

  private generateDropTable(tableName: string): MigrationStatement {
    return {
      type: 'drop_table',
      sql: `DROP TABLE IF EXISTS ${tableName} CASCADE;`,
      description: `Drop table ${tableName}`,
      transaction: true,
    };
  }

  private generateAddColumn(tableName: string, column: ColumnDefinition): MigrationStatement {
    const columnDef = this.formatColumnDefinition(column);
    return {
      type: 'add_column',
      sql: `ALTER TABLE ${tableName} ADD COLUMN ${columnDef};`,
      description: `Add column ${column.name} to ${tableName}`,
      transaction: true,
    };
  }

  private generateDropColumn(tableName: string, columnName: string): MigrationStatement {
    return {
      type: 'drop_column',
      sql: `ALTER TABLE ${tableName} DROP COLUMN IF EXISTS ${columnName};`,
      description: `Drop column ${columnName} from ${tableName}`,
      transaction: true,
    };
  }

  private generateAlterColumn(tableName: string, column: ColumnDefinition): MigrationStatement {
    const statements: string[] = [];

    // Alter type
    statements.push(
      `ALTER TABLE ${tableName} ALTER COLUMN ${column.name} TYPE ${this.formatColumnType(column.type)};`
    );

    // Alter nullability
    if (column.nullable) {
      statements.push(`ALTER TABLE ${tableName} ALTER COLUMN ${column.name} DROP NOT NULL;`);
    } else {
      statements.push(`ALTER TABLE ${tableName} ALTER COLUMN ${column.name} SET NOT NULL;`);
    }

    // Alter default
    if (column.defaultValue !== undefined) {
      statements.push(
        `ALTER TABLE ${tableName} ALTER COLUMN ${column.name} SET DEFAULT ${column.defaultValue};`
      );
    } else {
      statements.push(`ALTER TABLE ${tableName} ALTER COLUMN ${column.name} DROP DEFAULT;`);
    }

    return {
      type: 'alter_column',
      sql: statements.join('\n'),
      description: `Alter column ${column.name} in ${tableName}`,
      transaction: true,
    };
  }

  private generateCreateIndex(index: IndexDefinition): MigrationStatement {
    const columns = index.columns
      .map((c) => `${c.name}${c.order ? ` ${c.order.toUpperCase()}` : ''}`)
      .join(', ');

    let sql = `CREATE`;
    if (index.unique) sql += ' UNIQUE';
    sql += ` INDEX ${index.name} ON ${index.table}`;

    if (index.type && index.type !== 'btree') {
      sql += ` USING ${index.type}`;
    }

    sql += ` (${columns})`;

    if (index.include && index.include.length > 0) {
      sql += ` INCLUDE (${index.include.join(', ')})`;
    }

    if (index.where) {
      sql += ` WHERE ${index.where}`;
    }

    sql += ';';

    return {
      type: 'add_index',
      sql,
      description: `Create index ${index.name} on ${index.table}`,
      transaction: true,
    };
  }

  private generateDropIndex(indexName: string): MigrationStatement {
    return {
      type: 'drop_index',
      sql: `DROP INDEX IF EXISTS ${indexName};`,
      description: `Drop index ${indexName}`,
      transaction: true,
    };
  }

  private generateAddForeignKey(relationship: RelationshipDefinition): MigrationStatement {
    const constraintName = `fk_${relationship.targetTable}_${relationship.targetColumn}`;
    let sql = `ALTER TABLE ${relationship.targetTable} ADD CONSTRAINT ${constraintName} `;
    sql += `FOREIGN KEY (${relationship.targetColumn}) REFERENCES ${relationship.sourceTable}(${relationship.sourceColumn})`;

    if (relationship.cascadeDelete) {
      sql += ' ON DELETE CASCADE';
    }
    if (relationship.cascadeUpdate) {
      sql += ' ON UPDATE CASCADE';
    }

    sql += ';';

    return {
      type: 'add_constraint',
      sql,
      description: `Add foreign key ${constraintName}`,
      transaction: true,
    };
  }

  private generateDropForeignKey(relationship: RelationshipDefinition): MigrationStatement {
    const constraintName = `fk_${relationship.targetTable}_${relationship.targetColumn}`;
    return {
      type: 'drop_constraint',
      sql: `ALTER TABLE ${relationship.targetTable} DROP CONSTRAINT IF EXISTS ${constraintName};`,
      description: `Drop foreign key ${constraintName}`,
      transaction: true,
    };
  }

  private formatColumnDefinition(column: ColumnDefinition): string {
    let def = `${column.name} ${this.formatColumnType(column.type)}`;

    if (!column.nullable) {
      def += ' NOT NULL';
    }

    if (column.defaultValue !== undefined && column.defaultValue !== null) {
      def += ` DEFAULT ${column.defaultValue}`;
    }

    if (column.unique && !column.primaryKey) {
      def += ' UNIQUE';
    }

    if (column.references) {
      def += ` REFERENCES ${column.references.table}(${column.references.column})`;
      if (column.references.onDelete) {
        def += ` ON DELETE ${column.references.onDelete.toUpperCase().replace('_', ' ')}`;
      }
      if (column.references.onUpdate) {
        def += ` ON UPDATE ${column.references.onUpdate.toUpperCase().replace('_', ' ')}`;
      }
    }

    return def;
  }

  private formatColumnType(type: ColumnType): string {
    const typeMap: Record<ColumnType, string> = {
      integer: 'INTEGER',
      bigint: 'BIGINT',
      smallint: 'SMALLINT',
      decimal: 'DECIMAL(10,2)',
      numeric: 'NUMERIC',
      real: 'REAL',
      double: 'DOUBLE PRECISION',
      serial: 'SERIAL',
      bigserial: 'BIGSERIAL',
      varchar: 'VARCHAR(255)',
      char: 'CHAR(1)',
      text: 'TEXT',
      uuid: 'UUID',
      citext: 'CITEXT',
      date: 'DATE',
      time: 'TIME',
      timestamp: 'TIMESTAMP',
      timestamptz: 'TIMESTAMPTZ',
      interval: 'INTERVAL',
      boolean: 'BOOLEAN',
      bytea: 'BYTEA',
      blob: 'BYTEA',
      json: 'JSON',
      jsonb: 'JSONB',
      array: 'TEXT[]',
      point: 'POINT',
      line: 'LINE',
      polygon: 'POLYGON',
      inet: 'INET',
      cidr: 'CIDR',
      macaddr: 'MACADDR',
      enum: 'VARCHAR(50)',
      custom: 'TEXT',
    };

    return typeMap[type] || 'TEXT';
  }

  private calculateChecksum(statements: MigrationStatement[]): string {
    const content = statements.map((s) => s.sql).join('\n');
    return createHash('sha256').update(content).digest('hex');
  }

  private generateId(): string {
    return `mig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// =============================================================================
// DATABASE AUTOMATION SERVICE
// =============================================================================

export class DatabaseAutomationService {
  private static instance: DatabaseAutomationService;
  private schemaGenerator: SchemaGenerator;
  private migrationGenerator: MigrationGenerator;
  private schemas: Map<string, DatabaseSchema> = new Map();
  private migrations: Map<string, Migration> = new Map();
  private connections: Map<string, DatabaseConnection> = new Map();
  private eventHandlers: Set<DatabaseEventHandler> = new Set();

  private constructor() {
    this.schemaGenerator = new SchemaGenerator();
    this.migrationGenerator = new MigrationGenerator();
  }

  static getInstance(): DatabaseAutomationService {
    if (!DatabaseAutomationService.instance) {
      DatabaseAutomationService.instance = new DatabaseAutomationService();
    }
    return DatabaseAutomationService.instance;
  }

  // ===========================================================================
  // SCHEMA OPERATIONS
  // ===========================================================================

  async generateSchema(request: SchemaGenerationRequest): Promise<DatabaseSchema> {
    const schema = this.schemaGenerator.generateFromDescription(request);
    this.schemas.set(schema.id, schema);

    this.emit({ type: 'schema_created', data: schema });

    return schema;
  }

  async getSchema(schemaId: string): Promise<DatabaseSchema | null> {
    return this.schemas.get(schemaId) || null;
  }

  async updateSchema(
    schemaId: string,
    updates: Partial<DatabaseSchema>
  ): Promise<DatabaseSchema> {
    const schema = this.schemas.get(schemaId);
    if (!schema) {
      throw new Error(`Schema not found: ${schemaId}`);
    }

    const updatedSchema: DatabaseSchema = {
      ...schema,
      ...updates,
      version: schema.version + 1,
      updatedAt: new Date().toISOString(),
    };

    this.schemas.set(schemaId, updatedSchema);

    // Calculate changes for event
    const diff = this.diffSchemas(schema, updatedSchema);

    this.emit({ type: 'schema_updated', data: { schemaId, changes: diff.changes } });

    return updatedSchema;
  }

  async addTable(schemaId: string, table: TableDefinition): Promise<DatabaseSchema> {
    const schema = await this.getSchema(schemaId);
    if (!schema) {
      throw new Error(`Schema not found: ${schemaId}`);
    }

    schema.tables.push(table);
    return this.updateSchema(schemaId, { tables: schema.tables });
  }

  async removeTable(schemaId: string, tableName: string): Promise<DatabaseSchema> {
    const schema = await this.getSchema(schemaId);
    if (!schema) {
      throw new Error(`Schema not found: ${schemaId}`);
    }

    schema.tables = schema.tables.filter((t) => t.name !== tableName);
    schema.relationships = schema.relationships.filter(
      (r) => r.sourceTable !== tableName && r.targetTable !== tableName
    );
    schema.indexes = schema.indexes.filter((i) => i.table !== tableName);

    return this.updateSchema(schemaId, {
      tables: schema.tables,
      relationships: schema.relationships,
      indexes: schema.indexes,
    });
  }

  // ===========================================================================
  // MIGRATION OPERATIONS
  // ===========================================================================

  async generateMigration(
    sourceSchemaId: string,
    targetSchemaId: string
  ): Promise<Migration> {
    const sourceSchema = await this.getSchema(sourceSchemaId);
    const targetSchema = await this.getSchema(targetSchemaId);

    if (!sourceSchema || !targetSchema) {
      throw new Error('Source or target schema not found');
    }

    const diff = this.diffSchemas(sourceSchema, targetSchema);
    const migration = this.migrationGenerator.generateFromDiff(diff);

    this.migrations.set(migration.id, migration);

    this.emit({ type: 'migration_created', data: migration });

    return migration;
  }

  async generateMigrationFromChanges(
    schemaId: string,
    changes: SchemaChange[]
  ): Promise<Migration> {
    const schema = await this.getSchema(schemaId);
    if (!schema) {
      throw new Error(`Schema not found: ${schemaId}`);
    }

    const diff: SchemaDiff = {
      sourceSchema: schema,
      targetSchema: schema,
      changes,
      migrationStatements: [],
      destructive: changes.some((c) => c.breaking),
      warnings: [],
    };

    const migration = this.migrationGenerator.generateFromDiff(diff);
    this.migrations.set(migration.id, migration);

    this.emit({ type: 'migration_created', data: migration });

    return migration;
  }

  async applyMigration(
    migrationId: string,
    connectionId: string
  ): Promise<{ success: boolean; duration: number; error?: string }> {
    const migration = this.migrations.get(migrationId);
    if (!migration) {
      throw new Error(`Migration not found: ${migrationId}`);
    }

    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    const startTime = Date.now();

    try {
      // In a real implementation, this would execute the SQL
      // against the actual database connection
      console.log(`Applying migration ${migration.name} to ${connection.database}`);

      for (const statement of migration.up) {
        console.log(`Executing: ${statement.description}`);
        // await this.executeSQL(connection, statement.sql);
      }

      migration.status = 'applied';
      migration.appliedAt = new Date().toISOString();

      const duration = Date.now() - startTime;

      this.emit({ type: 'migration_applied', data: { migrationId, duration } });

      return { success: true, duration };
    } catch (error) {
      migration.status = 'failed';

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.emit({ type: 'migration_failed', data: { migrationId, error: errorMessage } });

      return { success: false, duration: Date.now() - startTime, error: errorMessage };
    }
  }

  async rollbackMigration(
    migrationId: string,
    connectionId: string
  ): Promise<{ success: boolean; error?: string }> {
    const migration = this.migrations.get(migrationId);
    if (!migration) {
      throw new Error(`Migration not found: ${migrationId}`);
    }

    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    try {
      console.log(`Rolling back migration ${migration.name}`);

      for (const statement of migration.down) {
        console.log(`Executing: ${statement.description}`);
        // await this.executeSQL(connection, statement.sql);
      }

      migration.status = 'rolled_back';
      migration.rolledBackAt = new Date().toISOString();

      this.emit({ type: 'migration_rolled_back', data: { migrationId } });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  async getMigration(migrationId: string): Promise<Migration | null> {
    return this.migrations.get(migrationId) || null;
  }

  async listMigrations(schemaId?: string): Promise<Migration[]> {
    let migrations = Array.from(this.migrations.values());

    if (schemaId) {
      migrations = migrations.filter((m) => m.schemaId === schemaId);
    }

    return migrations.sort((a, b) => b.version - a.version);
  }

  // ===========================================================================
  // SEED OPERATIONS
  // ===========================================================================

  async executeSeed(
    seed: SeedData,
    connectionId: string
  ): Promise<{ success: boolean; rowsAffected: number; error?: string }> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    let totalRowsAffected = 0;

    try {
      for (const tableSeed of seed.tables) {
        if (tableSeed.truncate) {
          console.log(`Truncating table ${tableSeed.table}`);
          // await this.executeSQL(connection, `TRUNCATE TABLE ${tableSeed.table} CASCADE`);
        }

        for (const row of tableSeed.data) {
          const columns = Object.keys(row);
          const values = columns.map((c) => this.formatValue(row[c]));

          let sql = `INSERT INTO ${tableSeed.table} (${columns.join(', ')}) VALUES (${values.join(', ')})`;

          if (tableSeed.onConflict === 'ignore') {
            sql += ' ON CONFLICT DO NOTHING';
          } else if (tableSeed.onConflict === 'update' && tableSeed.updateColumns) {
            const updates = tableSeed.updateColumns
              .map((c) => `${c} = EXCLUDED.${c}`)
              .join(', ');
            sql += ` ON CONFLICT DO UPDATE SET ${updates}`;
          }

          console.log(`Inserting into ${tableSeed.table}`);
          // await this.executeSQL(connection, sql);
          totalRowsAffected++;
        }
      }

      this.emit({ type: 'seed_executed', data: { seedId: seed.id, rowsAffected: totalRowsAffected } });

      return { success: true, rowsAffected: totalRowsAffected };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, rowsAffected: totalRowsAffected, error: errorMessage };
    }
  }

  // ===========================================================================
  // CONNECTION OPERATIONS
  // ===========================================================================

  async addConnection(connection: DatabaseConnection): Promise<void> {
    this.connections.set(connection.id, connection);

    // Test connection
    try {
      // In a real implementation, this would test the connection
      console.log(`Testing connection to ${connection.host}:${connection.port}/${connection.database}`);

      this.emit({ type: 'connection_established', data: { connectionId: connection.id } });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit({ type: 'connection_failed', data: { connectionId: connection.id, error: errorMessage } });
      throw error;
    }
  }

  async removeConnection(connectionId: string): Promise<void> {
    this.connections.delete(connectionId);
  }

  async getConnection(connectionId: string): Promise<DatabaseConnection | null> {
    return this.connections.get(connectionId) || null;
  }

  // ===========================================================================
  // SCHEMA DIFFING
  // ===========================================================================

  diffSchemas(source: DatabaseSchema, target: DatabaseSchema): SchemaDiff {
    const changes: SchemaChange[] = [];
    const warnings: string[] = [];
    let destructive = false;

    // Diff tables
    const sourceTables = new Map(source.tables.map((t) => [t.name, t]));
    const targetTables = new Map(target.tables.map((t) => [t.name, t]));

    // Find added tables
    for (const [name, table] of targetTables) {
      if (!sourceTables.has(name)) {
        changes.push({
          type: 'added',
          entity: 'table',
          name,
          after: table,
          breaking: false,
          description: `Add table ${name}`,
        });
      }
    }

    // Find removed tables
    for (const [name, table] of sourceTables) {
      if (!targetTables.has(name)) {
        changes.push({
          type: 'removed',
          entity: 'table',
          name,
          before: table,
          breaking: true,
          description: `Drop table ${name}`,
        });
        destructive = true;
        warnings.push(`Dropping table ${name} will delete all data`);
      }
    }

    // Find modified tables (column changes)
    for (const [name, sourceTable] of sourceTables) {
      const targetTable = targetTables.get(name);
      if (targetTable) {
        const columnChanges = this.diffColumns(sourceTable, targetTable);
        changes.push(...columnChanges);

        if (columnChanges.some((c) => c.breaking)) {
          destructive = true;
        }
      }
    }

    // Diff indexes
    const sourceIndexes = new Map(source.indexes.map((i) => [i.name, i]));
    const targetIndexes = new Map(target.indexes.map((i) => [i.name, i]));

    for (const [name, index] of targetIndexes) {
      if (!sourceIndexes.has(name)) {
        changes.push({
          type: 'added',
          entity: 'index',
          name,
          after: index,
          breaking: false,
          description: `Add index ${name}`,
        });
      }
    }

    for (const [name, index] of sourceIndexes) {
      if (!targetIndexes.has(name)) {
        changes.push({
          type: 'removed',
          entity: 'index',
          name,
          before: index,
          breaking: false,
          description: `Drop index ${name}`,
        });
      }
    }

    return {
      sourceSchema: source,
      targetSchema: target,
      changes,
      migrationStatements: [],
      destructive,
      warnings,
    };
  }

  private diffColumns(source: TableDefinition, target: TableDefinition): SchemaChange[] {
    const changes: SchemaChange[] = [];

    const sourceColumns = new Map(source.columns.map((c) => [c.name, c]));
    const targetColumns = new Map(target.columns.map((c) => [c.name, c]));

    // Find added columns
    for (const [name, column] of targetColumns) {
      if (!sourceColumns.has(name)) {
        changes.push({
          type: 'added',
          entity: 'column',
          name,
          table: target.name,
          after: column,
          breaking: !column.nullable && column.defaultValue === undefined,
          description: `Add column ${name} to ${target.name}`,
        });
      }
    }

    // Find removed columns
    for (const [name, column] of sourceColumns) {
      if (!targetColumns.has(name)) {
        changes.push({
          type: 'removed',
          entity: 'column',
          name,
          table: source.name,
          before: column,
          breaking: true,
          description: `Drop column ${name} from ${source.name}`,
        });
      }
    }

    // Find modified columns
    for (const [name, sourceColumn] of sourceColumns) {
      const targetColumn = targetColumns.get(name);
      if (targetColumn) {
        if (
          sourceColumn.type !== targetColumn.type ||
          sourceColumn.nullable !== targetColumn.nullable
        ) {
          changes.push({
            type: 'modified',
            entity: 'column',
            name,
            table: source.name,
            before: sourceColumn,
            after: targetColumn,
            breaking: sourceColumn.type !== targetColumn.type,
            description: `Modify column ${name} in ${source.name}`,
          });
        }
      }
    }

    return changes;
  }

  // ===========================================================================
  // SQL GENERATION HELPERS
  // ===========================================================================

  generateSQL(schema: DatabaseSchema): string {
    const statements: string[] = [];

    // Generate CREATE TABLE statements
    for (const table of schema.tables) {
      const columns = table.columns
        .map((col) => {
          let def = `  ${col.name} ${this.formatColumnType(col.type)}`;
          if (!col.nullable) def += ' NOT NULL';
          if (col.defaultValue !== undefined) def += ` DEFAULT ${col.defaultValue}`;
          if (col.primaryKey) def += ' PRIMARY KEY';
          return def;
        })
        .join(',\n');

      statements.push(`CREATE TABLE ${table.name} (\n${columns}\n);`);
    }

    // Generate CREATE INDEX statements
    for (const index of schema.indexes) {
      const columns = index.columns.map((c) => c.name).join(', ');
      let sql = `CREATE`;
      if (index.unique) sql += ' UNIQUE';
      sql += ` INDEX ${index.name} ON ${index.table} (${columns});`;
      statements.push(sql);
    }

    // Generate RLS policies
    if (schema.policies && schema.policies.length > 0) {
      for (const table of schema.tables) {
        statements.push(`ALTER TABLE ${table.name} ENABLE ROW LEVEL SECURITY;`);
      }

      for (const policy of schema.policies) {
        let sql = `CREATE POLICY ${policy.name} ON ${policy.table}`;
        sql += ` FOR ${policy.command.toUpperCase()}`;
        if (policy.using) sql += ` USING (${policy.using})`;
        if (policy.withCheck) sql += ` WITH CHECK (${policy.withCheck})`;
        sql += ';';
        statements.push(sql);
      }
    }

    return statements.join('\n\n');
  }

  private formatColumnType(type: ColumnType): string {
    const typeMap: Record<ColumnType, string> = {
      integer: 'INTEGER',
      bigint: 'BIGINT',
      smallint: 'SMALLINT',
      decimal: 'DECIMAL(10,2)',
      numeric: 'NUMERIC',
      real: 'REAL',
      double: 'DOUBLE PRECISION',
      serial: 'SERIAL',
      bigserial: 'BIGSERIAL',
      varchar: 'VARCHAR(255)',
      char: 'CHAR(1)',
      text: 'TEXT',
      uuid: 'UUID',
      citext: 'CITEXT',
      date: 'DATE',
      time: 'TIME',
      timestamp: 'TIMESTAMP',
      timestamptz: 'TIMESTAMPTZ',
      interval: 'INTERVAL',
      boolean: 'BOOLEAN',
      bytea: 'BYTEA',
      blob: 'BYTEA',
      json: 'JSON',
      jsonb: 'JSONB',
      array: 'TEXT[]',
      point: 'POINT',
      line: 'LINE',
      polygon: 'POLYGON',
      inet: 'INET',
      cidr: 'CIDR',
      macaddr: 'MACADDR',
      enum: 'VARCHAR(50)',
      custom: 'TEXT',
    };

    return typeMap[type] || 'TEXT';
  }

  private formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`;
    }
    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }
    if (typeof value === 'object') {
      return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
    }
    return String(value);
  }

  // ===========================================================================
  // EVENT HANDLING
  // ===========================================================================

  subscribe(handler: DatabaseEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  private emit(event: DatabaseEvent): void {
    this.eventHandlers.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        console.error('Event handler error:', error);
      }
    });
  }
}

// Export singleton
export const databaseAutomation = DatabaseAutomationService.getInstance();
