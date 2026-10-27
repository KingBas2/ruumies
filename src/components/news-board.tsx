import { ActionSheet } from '@/components/action-sheet';
import { useDialog } from '@/lib/dialog';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Post = {
  id: string;
  author_id: string | null;
  content: string;
  created_at: string;
};

type Member = {
  id: string;
  display_name: string | null;
};

const PREVIEW_COUNT = 3;

// "vor 5 Min.", "gestern", "12. Okt." ...
function timeAgo(iso: string) {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return 'gerade eben';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'gestern';
  if (days < 7) return `vor ${days} Tagen`;
  return new Date(iso).toLocaleDateString('de-AT', { day: 'numeric', month: 'short' });
}

export function NewsBoard({ refreshKey = 0 }: { refreshKey?: number }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const dialog = useDialog();

  const loadPosts = useCallback(async () => {
    const { data, error } = await supabase
      .from('news_posts')
      .select('id, author_id, content, created_at')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) console.error(error);
    else setPosts(data ?? []);
  }, []);

  useEffect(() => {
    loadPosts();
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    supabase
      .from('profiles')
      .select('id, display_name')
      .then(({ data, error }) => {
        if (error) console.error(error);
        else setMembers(data ?? []);
      });

    const channel = supabase
      .channel('news-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'news_posts' }, () => loadPosts())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadPosts]);

  // Neu laden, wenn die Startseite heruntergezogen wird
  useEffect(() => {
    if (refreshKey > 0) loadPosts();
  }, [refreshKey, loadPosts]);

  function authorName(id: string | null) {
    if (id === userId) return 'Du';
    return members.find((m) => m.id === id)?.display_name ?? 'Ehemalig';
  }

  function startEdit(post: Post) {
    setEditingPost(post);
    setText(post.content);
  }

  function cancelEdit() {
    setEditingPost(null);
    setText('');
  }

  async function sendPost() {
    const trimmed = text.trim();
    if (!trimmed) return;

    setSending(true);
    const { error } = editingPost
      ? await supabase.from('news_posts').update({ content: trimmed }).eq('id', editingPost.id)
      : await supabase.from('news_posts').insert({ content: trimmed });
    setSending(false);

    if (error) {
      dialog.alert('Das hat nicht geklappt', error.message);
      return;
    }
    cancelEdit();
    loadPosts();
  }

  async function deletePost(post: Post) {
    setPosts((prev) => prev.filter((p) => p.id !== post.id));
    const { error } = await supabase.from('news_posts').delete().eq('id', post.id);
    if (error) {
      loadPosts();
      dialog.alert('Das hat nicht geklappt', error.message);
    }
  }

  const visiblePosts = showAll ? posts : posts.slice(0, PREVIEW_COUNT);

  return (
    <View>
      <Text style={styles.sectionTitle}>📌 Pinnwand</Text>

      <View style={styles.card}>

         {editingPost && (
          <View style={styles.editBanner}>
            <Text style={styles.editBannerText}>✏️ Beitrag bearbeiten</Text>
            <Pressable onPress={cancelEdit} hitSlop={8}>
              <Text style={styles.editCancel}>Abbrechen</Text>
            </Pressable>
          </View>
        )}
        {/* Neuer Beitrag */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Was gibt's Neues?"
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
          />
          <Pressable
            style={[styles.sendButton, (!text.trim() || sending) && styles.sendButtonDisabled]}
            onPress={sendPost}
            disabled={!text.trim() || sending}
          >
            <Text style={styles.sendButtonText}>{editingPost ? '✓' : '↑'}</Text>
          </Pressable>
        </View>

        {/* Beiträge */}
        {posts.length === 0 ? (
          <Text style={styles.empty}>Noch nichts los. Schreib den ersten Beitrag!</Text>
        ) : (
          visiblePosts.map((post) => (
            <Pressable
              key={post.id}
              style={styles.post}
              onLongPress={() => post.author_id === userId && setSelectedPost(post)}
            >
              <View style={styles.postHeader}>
                <Text style={styles.postAuthor}>{authorName(post.author_id)}</Text>
                <Text style={styles.postTime}>{timeAgo(post.created_at)}</Text>
              </View>
              <Text style={styles.postContent}>{post.content}</Text>
            </Pressable>
          ))
        )}

        {posts.length > PREVIEW_COUNT && (
          <Pressable style={styles.moreButton} onPress={() => setShowAll(!showAll)}>
            <Text style={styles.moreText}>
              {showAll ? 'Weniger anzeigen' : `Alle ${posts.length} anzeigen`}
            </Text>
          </Pressable>
        )}
      </View>

      <ActionSheet
        visible={selectedPost !== null}
        title="Dein Beitrag"
        subtitle={selectedPost?.content}
        actions={
          selectedPost
            ? [
                { label: 'Bearbeiten', emoji: '✏️', onPress: () => startEdit(selectedPost) },
                { label: 'Löschen', emoji: '🗑️', destructive: true, onPress: () => deletePost(selectedPost) },
              ]
            : []
        }
        onClose={() => setSelectedPost(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12, marginTop: 32 },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8 },
  input: {
    flex: 1, backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 14,
    paddingTop: 12, paddingBottom: 12, fontSize: 16, maxHeight: 120, marginRight: 8,
  },
  sendButton: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.4 },
  sendButtonText: { color: 'white', fontSize: 20, fontWeight: '700' },
  post: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.surfaceMuted },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  postAuthor: { fontSize: 14, fontWeight: '700', color: colors.text },
  postTime: { fontSize: 13, color: colors.textFaint },
  postContent: { fontSize: 15, color: colors.text, lineHeight: 21 },
  empty: { textAlign: 'center', color: colors.textMuted, fontSize: 15, paddingVertical: 12 },
  moreButton: { paddingTop: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.surfaceMuted },
  moreText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  editBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.surfaceMuted, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 10,
  },
  editBannerText: { fontSize: 14, color: colors.text, fontWeight: '600' },
  editCancel: { fontSize: 14, color: colors.accent, fontWeight: '600' },
});