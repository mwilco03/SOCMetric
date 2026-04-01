use keyring::Entry;
use crate::constants::{KEYRING_SERVICE, KEYRING_ACCOUNT};
use crate::error::AppError;
use crate::models::credential::Credential;

fn get_entry() -> Result<Entry, AppError> {
    Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT).map_err(|e| AppError::Keyring(e.to_string()))
}

pub fn store_credentials(cred: &Credential) -> Result<(), AppError> {
    let json = serde_json::to_string(cred).map_err(|e| AppError::General(e.to_string()))?;
    let entry = get_entry()?;
    entry.set_password(&json)?;
    Ok(())
}

pub fn get_credentials() -> Result<Option<Credential>, AppError> {
    let entry = get_entry()?;
    match entry.get_password() {
        Ok(json) => {
            let cred: Credential = serde_json::from_str(&json)
                .map_err(|e| AppError::General(format!("Failed to parse credentials: {}", e)))?;
            Ok(Some(cred))
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(AppError::Keyring(e.to_string())),
    }
}

pub fn delete_credentials() -> Result<(), AppError> {
    let entry = get_entry()?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()), // Already gone
        Err(e) => Err(AppError::Keyring(e.to_string())),
    }
}

pub fn has_credentials() -> bool {
    get_credentials().ok().flatten().is_some()
}
