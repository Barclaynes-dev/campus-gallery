-- ============================================================
--  database/schema.sql — Campus Gallery Database Schema
--  Run this file in MySQL Workbench to create all tables.
--  Steps: Open MySQL Workbench → File → Open SQL Script →
--         Select this file → Click the ⚡ Execute button
-- ============================================================

-- Create and select the database
CREATE DATABASE IF NOT EXISTS campus_gallery CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE campus_gallery;

-- ── Users Table ──────────────────────────────────────────────
-- Stores both the admin (designer) and friend accounts
CREATE TABLE IF NOT EXISTS users (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  username       VARCHAR(50)  NOT NULL UNIQUE,
  display_name   VARCHAR(100) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,              -- bcrypt hash, NEVER plain text
  role           ENUM('admin', 'friend') NOT NULL DEFAULT 'friend',
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Photos Table ─────────────────────────────────────────────
-- Stores metadata for every uploaded photo
-- The actual image file lives on Cloudinary (image_url points to it)
CREATE TABLE IF NOT EXISTS photos (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  title                 VARCHAR(255),
  image_url             TEXT NOT NULL,               -- Full Cloudinary URL
  cloudinary_public_id  VARCHAR(255) NOT NULL,       -- Used to delete from Cloudinary
  people_names          TEXT,                        -- Comma-separated names in the photo
  location              VARCHAR(255),                -- e.g. "Main Quad", "Library Cafe"
  photographer          VARCHAR(100),                -- Name of who took the photo
  year                  YEAR NOT NULL,               -- Category year e.g. 2025
  original_width        INT DEFAULT 0,               -- Original image width in pixels
  original_height       INT DEFAULT 0,               -- Original image height in pixels
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Favorites Table ──────────────────────────────────────────
-- Links a friend to a photo they saved
CREATE TABLE IF NOT EXISTS favorites (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  photo_id    INT NOT NULL,
  category_id INT DEFAULT NULL,                      -- Optional: assigned to a category
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_favorite (user_id, photo_id),   -- Prevent duplicate saves
  FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (photo_id)    REFERENCES photos(id) ON DELETE CASCADE
);

-- ── Categories Table ─────────────────────────────────────────
-- Custom categories each friend creates for their favorites
-- e.g. "Fall Semester 2024", "Study Sessions", "Weekend Trips"
CREATE TABLE IF NOT EXISTS categories (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  name        VARCHAR(100) NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── Seed: Create the admin account ───────────────────────────
-- Password is "admin123" — CHANGE THIS immediately after setup!
-- The hash below is bcrypt of "admin123" with salt rounds = 12
-- To change: generate a new hash with bcrypt and replace it here,
-- OR use the app's future "change password" feature.
INSERT IGNORE INTO users (username, display_name, password_hash, role)
VALUES (
  'admin',
  'Gallery Admin',
  '$2a$12$KIXjJ8yd7z2Zn3LhQkFqVOvX1mC4uN5pRbA9sT0eH7wG6yD2iJ3lK',
  'admin'
);

-- ── Useful Queries for Reference ─────────────────────────────
-- View all photos:       SELECT * FROM photos;
-- View all users:        SELECT id, username, role FROM users;
-- View all favorites:    SELECT * FROM favorites;
-- View all categories:   SELECT * FROM categories;
