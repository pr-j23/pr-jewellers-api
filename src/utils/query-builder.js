export class QueryBuilder {
  static createTableQuery(tableName, columns) {
    const columnDefinitions = columns
      .map(col => `${col.column_name} ${col.column_type}${col.nullable ? '' : ' NOT NULL'}`)
      .join(', ');

    return `
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ${columnDefinitions},
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
  }

  static insertQuery(tableName, data) {
    const columns = Object.keys(data);
    const placeholders = Array(columns.length).fill('?').join(', ');

    return {
      query: `
          INSERT INTO ${tableName} (${columns.join(', ')})
          VALUES (${placeholders})
        `,
      values: Object.values(data)
    };
  }

  static updateQuery(tableName, id, data) {
    const updates = Object.keys(data).map(key => `${key} = ?`).join(', ');

    return {
      query: `
          UPDATE ${tableName}
          SET ${updates}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
      values: [...Object.values(data), id]
    };
  }
}