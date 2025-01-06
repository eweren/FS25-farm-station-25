/*
:project: telegram-onedrive
:author: L-ING
:copyright: (C) 2024 L-ING <hlf01@icloud.com>
:license: MIT, see LICENSE for more details.
*/

use anyhow::{Context, Result};
use path_slash::PathExt;
use std::{
    io::{Read, Write},
    path::Path,
};
use zip::write::{FileOptions, SimpleFileOptions};

#[cfg(test)]
mod tests {
    use super::*;
    use crate::env::LOGS_PATH;

    #[test]
    fn test_zip_dir() {
        zip_dir(LOGS_PATH, "./logs.zip").unwrap();
    }
}
