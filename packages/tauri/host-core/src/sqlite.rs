use std::path::Path;

use anyhow::Context;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SqliteMigration {
    pub version: u32,
    pub description: String,
    pub sql: String,
}

pub fn read_user_version(db_path: impl AsRef<Path>) -> anyhow::Result<u32> {
    let db = Connection::open(db_path.as_ref())
        .with_context(|| format!("opening {}", db_path.as_ref().display()))?;
    Ok(db.query_row("PRAGMA user_version", [], |row| row.get::<_, u32>(0))?)
}

pub fn apply_sqlite_migrations(
    db_path: impl AsRef<Path>,
    migrations: &[SqliteMigration],
) -> anyhow::Result<u32> {
    let mut db = Connection::open(db_path.as_ref())
        .with_context(|| format!("opening {}", db_path.as_ref().display()))?;
    db.pragma_update(None, "foreign_keys", "ON")?;
    let mut current = db.query_row("PRAGMA user_version", [], |row| row.get::<_, u32>(0))?;
    let mut ordered = migrations.to_vec();
    ordered.sort_by_key(|migration| migration.version);
    for migration in ordered {
        if migration.version <= current {
            continue;
        }
        let transaction = db.transaction()?;
        transaction.execute_batch(&migration.sql)?;
        transaction.pragma_update(None, "user_version", migration.version)?;
        transaction.commit()?;
        current = migration.version;
    }
    Ok(current)
}

#[cfg(test)]
mod tests {
    use std::fs::remove_file;

    use super::*;

    #[test]
    fn applies_only_pending_migrations() {
        let path = std::env::temp_dir().join(format!("nphc-sqlite-{}.db", std::process::id()));
        let migrations = vec![
            SqliteMigration {
                version: 1,
                description: "create table".to_string(),
                sql: "CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY);".to_string(),
            },
            SqliteMigration {
                version: 2,
                description: "insert row".to_string(),
                sql: "INSERT OR IGNORE INTO items (id) VALUES ('one');".to_string(),
            },
        ];
        assert_eq!(
            apply_sqlite_migrations(&path, &migrations).expect("migrate"),
            2
        );
        assert_eq!(read_user_version(&path).expect("version"), 2);
        assert_eq!(
            apply_sqlite_migrations(&path, &migrations).expect("migrate again"),
            2
        );
        let _ = remove_file(path);
    }
}
