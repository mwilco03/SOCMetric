use std::path::Path;
use std::sync::Mutex;
use rusqlite::Connection;
use crate::error::AppError;
use crate::storage::schema;

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn open(path: &Path) -> Result<Self, AppError> {
        let conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        Ok(Database {
            conn: Mutex::new(conn),
        })
    }

    pub fn migrate(&self) -> Result<(), AppError> {
        let conn = self.conn.lock().map_err(|e| AppError::General(e.to_string()))?;
        schema::migrate(&conn)
    }

    pub fn with_conn<F, T>(&self, f: F) -> Result<T, AppError>
    where
        F: FnOnce(&Connection) -> Result<T, AppError>,
    {
        let conn = self.conn.lock().map_err(|e| AppError::General(e.to_string()))?;
        f(&conn)
    }
}
