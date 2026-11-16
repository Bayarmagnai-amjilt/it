-- =============================================================================
-- Tsahim Unaga — migration 6: the bird game
--
-- New projects already get 'bird' from migration 1. This adds it to projects
-- set up before 2026.11.16. A new enum value cannot be used in the transaction
-- that adds it, so it has its own migration; migration 7 seeds the levels.
-- =============================================================================
alter type puzzle_game add value if not exists 'bird';
