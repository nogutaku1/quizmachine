-- ==========================================
-- Supabase Setup SQL
-- ==========================================
-- 1. SQL Editor を開く
-- 2. "New Query" を作成
-- 3. このファイルの内容を貼り付けて "Run" を実行してください

-- ランキングテーブルの作成
create table if not exists rankings (
  id uuid default gen_random_uuid() primary key,
  player_name text not null,
  score integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- インデックスの作成（スコア順の取得を高速化）
create index if not exists rankings_score_idx on rankings (score desc);

-- RLS（行単位セキュリティ）を有効にする
alter table rankings enable row level security;

-- 既存のポリシーを削除（再実行時のエラー防止）
drop policy if exists "Allow public read access" on rankings;
drop policy if exists "Allow public insert access" on rankings;

-- データの読み取りを全員に許可
create policy "Allow public read access"
  on rankings for select
  using (true);

-- データの挿入を全員に許可
create policy "Allow public insert access"
  on rankings for insert
  with check (true);
