import Foundation
import SQLite3

private let SQLITE_TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

struct SQLiteError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

enum SQLiteValue {
    case int(Int)
    case text(String)
}

struct SQLiteRow {
    fileprivate let statement: OpaquePointer

    func int(_ column: Int32) -> Int {
        Int(sqlite3_column_int64(statement, column))
    }

    func text(_ column: Int32) -> String? {
        guard let value = sqlite3_column_text(statement, column) else { return nil }
        return String(cString: value)
    }

    func string(_ column: Int32) -> String {
        text(column) ?? ""
    }
}

/// A minimal read-only wrapper around the bundled SQLite word list.
///
/// Statements are cached and reused. Callers must not run another query from
/// inside a row-mapping closure, since the same statement may be reset.
final class SQLiteDatabase {
    private let handle: OpaquePointer
    private var statements: [String: OpaquePointer] = [:]

    init(path: String) throws {
        var db: OpaquePointer?
        let flags = SQLITE_OPEN_READONLY | SQLITE_OPEN_NOMUTEX
        guard sqlite3_open_v2(path, &db, flags, nil) == SQLITE_OK, let db else {
            let message = db.map { String(cString: sqlite3_errmsg($0)) } ?? "Could not open the word list."
            sqlite3_close(db)
            throw SQLiteError(message: message)
        }
        handle = db
    }

    deinit {
        for statement in statements.values {
            sqlite3_finalize(statement)
        }
        sqlite3_close(handle)
    }

    func rows<T>(_ sql: String, _ arguments: SQLiteValue..., map: (SQLiteRow) -> T) -> [T] {
        guard let statement = prepare(sql) else { return [] }
        defer {
            sqlite3_reset(statement)
            sqlite3_clear_bindings(statement)
        }
        for (index, argument) in arguments.enumerated() {
            let position = Int32(index + 1)
            switch argument {
            case .int(let value):
                sqlite3_bind_int64(statement, position, sqlite3_int64(value))
            case .text(let value):
                sqlite3_bind_text(statement, position, value, -1, SQLITE_TRANSIENT)
            }
        }
        var result: [T] = []
        while sqlite3_step(statement) == SQLITE_ROW {
            result.append(map(SQLiteRow(statement: statement)))
        }
        return result
    }

    private func prepare(_ sql: String) -> OpaquePointer? {
        if let cached = statements[sql] { return cached }
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(handle, sql, -1, &statement, nil) == SQLITE_OK, let statement else {
            assertionFailure("SQLite prepare failed: \(String(cString: sqlite3_errmsg(handle)))\n\(sql)")
            return nil
        }
        statements[sql] = statement
        return statement
    }
}
