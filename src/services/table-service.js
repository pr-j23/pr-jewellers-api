import { QueryBuilder } from '../utils/query-builder';

export class TableService {
    async createTable(db, tableName, columns) {
        const query = QueryBuilder.createTableQuery(tableName, columns);
        await db.prepare(query).run();
    }

    async addColumn(db, tableName, column_name, column_type, nullable) {
        const query = column_type.toUpperCase() === 'BOOLEAN' ?
        `ALTER TABLE ${tableName} ADD COLUMN ${column_name} INTEGER CHECK(${column_name} IN (0, 1)) DEFAULT 0${nullable ? '' : ' NOT NULL'}`
        : `ALTER TABLE ${tableName} ADD COLUMN ${column_name} ${column_type} ${nullable ? '' : ' NOT NULL'}`;
        await db.prepare(query).run();
    }

    async removeColumn(db, tableName, columnName) {
        const query = `ALTER TABLE ${tableName} DROP COLUMN ${columnName}`;
        await db.prepare(query).run();
    }

    async createRecord(db, tableName, data) {
        const { query, values } = QueryBuilder.insertQuery(tableName, data);
        try {
            const result = await db.prepare(query).bind(...values).run();
            return result
        }
        catch (error) {
            if (error.message.includes('CHECK constraint failed')) {
                // Extract column name from error message
                const match = error.message.match(/CHECK constraint failed: (\w+)/);
                const columnName = match ? match[1] : 'Unknown Column';
    
                return {
                    status: 'error',
                    message: `Column "${columnName}" will accept only boolean values (0 for false, 1 for true).`
                };
            }
            return { status: 'error', message: error?.message?.match(/:(.*?):/)[1].trim() || 'Error message, Not Found' }
        }
    }

    async getRecords(db, tableName, jsonColumns) {
        const query = `SELECT * FROM ${tableName}`;
        const result = await db.prepare(query).all();

        const processedResults = result?.results?.map(record => {
            const updatedRecord = { ...record }; // Clone the record to avoid mutating the original
            // Process only the columns specified in jsonColumns
            jsonColumns.forEach(column => {
                try {
                    // Convert binary data to string and parse JSON
                    updatedRecord[column] = JSON.parse(updatedRecord[column]);
                } catch (error) {
                    console.error(`Error deserializing JSONB data for column "${column}":`, error);
                    updatedRecord[column] = null;
                }
            });

            return updatedRecord;
        });

        return {
            success: result.success,
            meta: result.meta,
            results: processedResults,
        };
    }

    async updateRecord(db, tableName, id, data) {
        const { query, values } = QueryBuilder.updateQuery(tableName, id, data);
        try {
            const result = await db.prepare(query).bind(...values).run();
            return result
        }
        catch (error) {
            if (error.message.includes('CHECK constraint failed')) {
                // Extract column name from error message
                const match = error.message.match(/CHECK constraint failed: (\w+)/);
                const columnName = match ? match[1] : 'Unknown Column';
    
                return {
                    status: 'error',
                    message: `Column "${columnName}" will accept only boolean values (0 for false, 1 for true).`
                };
            }
            return { status: 'error', message: error?.message?.match(/:(.*):/)[1].trim() || 'Error message, Not Found' }
        }
    }

    async deleteRecord(db, tableName, id) {
        const query = `DELETE FROM ${tableName} WHERE id = ?`;
        try {
            const result = await db.prepare(query).bind(id).run();
            console.log(result)
            return result
        }
        catch (error) {
            console.log(error)
            return { status: 'error', message: error?.message?.match(/:(.*):/)[1].trim() || 'Error message, Not Found' }
        }
    }
}