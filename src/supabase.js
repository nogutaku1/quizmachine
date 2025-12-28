// ===================================
// Supabase クライアント
// ===================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Supabaseクライアントの初期化
export const supabase = supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

/**
 * スコアをランキングに登録
 * @param {string} playerName - プレイヤー名
 * @param {number} score - スコア（連続正解数）
 * @returns {Promise<boolean>} - 登録成功したかどうか
 */
export async function saveScore(playerName, score) {
    if (!supabase) {
        console.warn('Supabase is not configured. Score not saved.');
        return false;
    }

    try {
        const { error } = await supabase
            .from('rankings')
            .insert([
                { player_name: playerName, score: score }
            ]);

        if (error) {
            console.error('Error saving score:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error saving score:', error);
        return false;
    }
}

/**
 * ランキングTOP10を取得
 * @returns {Promise<Array<{player_name: string, score: number, created_at: string}>>}
 */
export async function getRankings() {
    if (!supabase) {
        console.warn('Supabase is not configured. Returning empty rankings.');
        return [];
    }

    try {
        const { data, error } = await supabase
            .from('rankings')
            .select('player_name, score, created_at')
            .order('score', { ascending: false })
            .limit(10);

        if (error) {
            console.error('Error fetching rankings:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Error fetching rankings:', error);
        return [];
    }
}

/**
 * 最高スコアを取得
 * @returns {Promise<number>}
 */
export async function getTopScore() {
    if (!supabase) {
        return 0;
    }

    try {
        const { data, error } = await supabase
            .from('rankings')
            .select('score')
            .order('score', { ascending: false })
            .limit(1);

        if (error || !data || data.length === 0) {
            return 0;
        }

        return data[0].score;
    } catch (error) {
        return 0;
    }
}
